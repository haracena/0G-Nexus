// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title Nexus Campaigns
 * @dev Manages token-incentivized campaigns for 0g-nexus.
 * Implements signature verification, time/claim gating, and ticket-level idempotency.
 */
contract Nexus is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    struct Campaign {
        address creator;
        IERC20 token;
        uint256 totalReward;
        uint256 remainingReward;
        uint256 rewardPerAction;
        string metadataUri; // 0G Storage URI
        address validator; // Address authorized to sign claim tickets
        address targetContract; // Contract where the action takes place
        uint64 startTime;
        uint64 endTime; // 0 for no end time
        uint32 maxClaims; // 0 for no limit
        uint32 claimCount;
        bool isActive;
    }

    uint256 public nextCampaignId;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    
    // Idempotency: keeps track of processed claim ticket IDs (e.g. transaction hashes)
    mapping(bytes32 => bool) public claimedTickets;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        address token,
        uint256 totalReward,
        uint256 rewardPerAction,
        string metadataUri,
        address validator,
        uint64 startTime,
        uint64 endTime,
        uint32 maxClaims,
        address indexed targetContract
    );

    event RewardClaimed(
        uint256 indexed campaignId,
        address indexed claimant,
        uint256 amount,
        bytes32 indexed ticketId
    );

    event CampaignCancelled(
        uint256 indexed campaignId,
        uint256 refundedAmount
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Creates a new campaign by depositing ERC20 tokens.
     * @param _token The ERC20 token used for rewards.
     * @param _totalReward Total amount of tokens funded.
     * @param _rewardPerAction Tokens rewarded per verified action.
     * @param _metadataUri URI pointing to campaign details (stored on 0G).
     * @param _validator Address authorized to sign claim tickets.
     * @param _targetContract Address of the contract where the user performs the action.
     * @param _startTime Timestamp when the campaign starts.
     * @param _endTime Timestamp when the campaign ends (0 for no end time).
     * @param _maxClaims Maximum number of claims (0 for no limit).
     */
    function createCampaign(
        IERC20 _token,
        uint256 _totalReward,
        uint256 _rewardPerAction,
        string calldata _metadataUri,
        address _validator,
        address _targetContract,
        uint64 _startTime,
        uint64 _endTime,
        uint32 _maxClaims
    ) external nonReentrant returns (uint256) {
        require(_totalReward > 0, "Total reward must be > 0");
        require(_rewardPerAction > 0, "Reward per action must be > 0");
        require(_totalReward >= _rewardPerAction, "Total reward < per action");
        require(_validator != address(0), "Validator cannot be zero address");
        if (_endTime > 0) {
            require(_endTime > _startTime, "End time must be after start time");
        }

        uint256 campaignId = nextCampaignId++;

        campaigns[campaignId] = Campaign({
            creator: msg.sender,
            token: _token,
            totalReward: _totalReward,
            remainingReward: _totalReward,
            rewardPerAction: _rewardPerAction,
            metadataUri: _metadataUri,
            validator: _validator,
            targetContract: _targetContract,
            startTime: _startTime,
            endTime: _endTime,
            maxClaims: _maxClaims,
            claimCount: 0,
            isActive: true
        });

        _token.safeTransferFrom(msg.sender, address(this), _totalReward);

        emit CampaignCreated(
            campaignId,
            msg.sender,
            address(_token),
            _totalReward,
            _rewardPerAction,
            _metadataUri,
            _validator,
            _startTime,
            _endTime,
            _maxClaims,
            _targetContract
        );

        return campaignId;
    }

    /**
     * @notice Allows a user to claim their reward by providing a validator signature.
     * @param _campaignId ID of the campaign.
     * @param _ticketId Unique ID for this claim (preventing duplicate claims of the same event).
     * @param _signature The cryptographic signature from the campaign's validator.
     */
    function claimReward(uint256 _campaignId, bytes32 _ticketId, bytes calldata _signature) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];

        _verifyCampaignStatus(campaign);
        require(!claimedTickets[_ticketId], "Ticket already claimed");

        // Verify cryptographic signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _campaignId,
                msg.sender,
                _ticketId,
                address(this),
                block.chainid
            )
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ethSignedMessageHash.recover(_signature);

        require(signer == campaign.validator, "Invalid validator signature");

        // Apply effects
        claimedTickets[_ticketId] = true;
        campaign.remainingReward -= campaign.rewardPerAction;
        campaign.claimCount++;
        hasClaimed[_campaignId][msg.sender] = true;

        if (campaign.remainingReward < campaign.rewardPerAction || 
            (campaign.maxClaims > 0 && campaign.claimCount >= campaign.maxClaims)) {
            campaign.isActive = false;
        }

        // Interaction
        campaign.token.safeTransfer(msg.sender, campaign.rewardPerAction);

        emit RewardClaimed(_campaignId, msg.sender, campaign.rewardPerAction, _ticketId);
    }

    /**
     * @notice Distributes a reward directly to a recipient (creator/admin sponsored).
     * @param _campaignId ID of the campaign.
     * @param _recipient Address of the user receiving the reward.
     * @param _ticketId Unique ID for this claim (preventing duplicate claims of the same event).
     */
    function distributeReward(uint256 _campaignId, address _recipient, bytes32 _ticketId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        
        require(msg.sender == campaign.creator || msg.sender == owner(), "Only creator or owner can distribute");
        _verifyCampaignStatus(campaign);
        require(!claimedTickets[_ticketId], "Ticket already claimed");

        // Apply effects
        claimedTickets[_ticketId] = true;
        campaign.remainingReward -= campaign.rewardPerAction;
        campaign.claimCount++;
        hasClaimed[_campaignId][_recipient] = true;

        if (campaign.remainingReward < campaign.rewardPerAction || 
            (campaign.maxClaims > 0 && campaign.claimCount >= campaign.maxClaims)) {
            campaign.isActive = false;
        }

        // Interaction
        campaign.token.safeTransfer(_recipient, campaign.rewardPerAction);

        emit RewardClaimed(_campaignId, _recipient, campaign.rewardPerAction, _ticketId);
    }

    /**
     * @notice Cancels a campaign and refunds remaining tokens.
     * @param _campaignId ID of the campaign.
     */
    function cancelCampaign(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator || msg.sender == owner(), "Not authorized");
        require(campaign.isActive, "Campaign already inactive");

        campaign.isActive = false;
        uint256 refundAmount = campaign.remainingReward;
        campaign.remainingReward = 0;

        if (refundAmount > 0) {
            campaign.token.safeTransfer(campaign.creator, refundAmount);
        }

        emit CampaignCancelled(_campaignId, refundAmount);
    }

    /**
     * @dev Helper to verify campaign active status, time gates, and claim limits.
     */
    function _verifyCampaignStatus(Campaign storage campaign) private view {
        require(campaign.isActive, "Campaign is not active");
        require(block.timestamp >= campaign.startTime, "Campaign has not started");
        if (campaign.endTime > 0) {
            require(block.timestamp <= campaign.endTime, "Campaign has ended");
        }
        if (campaign.maxClaims > 0) {
            require(campaign.claimCount < campaign.maxClaims, "Campaign claim limit reached");
        }
        require(campaign.remainingReward >= campaign.rewardPerAction, "Insufficient remaining funds");
    }
}
