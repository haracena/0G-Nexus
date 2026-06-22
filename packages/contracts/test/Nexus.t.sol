// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Nexus} from "../src/Nexus.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MTK") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}

contract NexusTest is Test {
    Nexus public nexus;
    MockToken public token;

    address public owner = address(1);
    address public creator = address(2);
    address public user = address(3);
    
    // Validator for campaign signature validation
    uint256 public validatorPrivateKey = 0xA11CE;
    address public validator;

    function setUp() public {
        vm.warp(1_700_000_000); // Set timestamp to a realistic Unix time to avoid subtraction underflow
        validator = vm.addr(validatorPrivateKey);

        vm.startPrank(owner);
        nexus = new Nexus();
        token = new MockToken();
        vm.stopPrank();

        // Give creator some tokens
        vm.prank(owner);
        token.transfer(creator, 1000 * 10 ** 18);
    }

    function test_CreateCampaign() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        
        uint256 campaignId = nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            10
        );
        vm.stopPrank();

        assertEq(campaignId, 0);
        assertEq(token.balanceOf(address(nexus)), 100 * 10 ** 18);
    }

    function test_ClaimRewardWithSignature() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            10
        );
        vm.stopPrank();

        bytes32 ticketId = keccak256("user-action-1");

        // Prepare signature from validator
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                uint256(0), // campaignId
                user,
                ticketId,
                address(nexus),
                block.chainid
            )
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(validatorPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Claim reward
        uint256 balanceBefore = token.balanceOf(user);
        vm.prank(user);
        nexus.claimReward(0, ticketId, signature);

        assertEq(token.balanceOf(user), balanceBefore + 10 * 10 ** 18);
    }

    function test_RevertIf_InvalidSignature() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            10
        );
        vm.stopPrank();

        bytes32 ticketId = keccak256("user-action-1");

        // Sign with a different private key
        uint256 wrongPrivateKey = 0xBAD;
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                uint256(0),
                user,
                ticketId,
                address(nexus),
                block.chainid
            )
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid validator signature");
        vm.prank(user);
        nexus.claimReward(0, ticketId, signature);
    }

    function test_RevertIf_CampaignNotStarted() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp + 1 hours), // Starts in 1 hour
            uint64(block.timestamp + 1 days),
            10
        );
        vm.stopPrank();

        bytes32 ticketId = keccak256("user-action-1");
        bytes32 messageHash = keccak256(abi.encodePacked(uint256(0), user, ticketId, address(nexus), block.chainid));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(validatorPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Campaign has not started");
        vm.prank(user);
        nexus.claimReward(0, ticketId, signature);
    }

    function test_RevertIf_CampaignEnded() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp - 2 hours),
            uint64(block.timestamp - 1 hours), // Ended 1 hour ago
            10
        );
        vm.stopPrank();

        bytes32 ticketId = keccak256("user-action-1");
        bytes32 messageHash = keccak256(abi.encodePacked(uint256(0), user, ticketId, address(nexus), block.chainid));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(validatorPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Campaign has ended");
        vm.prank(user);
        nexus.claimReward(0, ticketId, signature);
    }

    function test_RevertIf_ClaimLimitReached() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            1 // Only 1 claim allowed
        );
        vm.stopPrank();

        // 1st claim succeeds
        bytes32 ticketId1 = keccak256("user-action-1");
        bytes32 messageHash1 = keccak256(abi.encodePacked(uint256(0), user, ticketId1, address(nexus), block.chainid));
        bytes32 ethSignedMessageHash1 = MessageHashUtils.toEthSignedMessageHash(messageHash1);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(validatorPrivateKey, ethSignedMessageHash1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        
        vm.prank(user);
        nexus.claimReward(0, ticketId1, signature1);

        // 2nd claim fails
        address user2 = address(4);
        bytes32 ticketId2 = keccak256("user-action-2");
        bytes32 messageHash2 = keccak256(abi.encodePacked(uint256(0), user2, ticketId2, address(nexus), block.chainid));
        bytes32 ethSignedMessageHash2 = MessageHashUtils.toEthSignedMessageHash(messageHash2);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(validatorPrivateKey, ethSignedMessageHash2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        vm.expectRevert("Campaign is not active"); // Campaign is auto-deactivated when limit is reached
        vm.prank(user2);
        nexus.claimReward(0, ticketId2, signature2);
    }

    function test_RevertIf_DuplicateTicketClaimed() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            10
        );
        vm.stopPrank();

        bytes32 ticketId = keccak256("user-action-1");
        bytes32 messageHash = keccak256(abi.encodePacked(uint256(0), user, ticketId, address(nexus), block.chainid));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(validatorPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 1st claim with ticketId succeeds
        vm.prank(user);
        nexus.claimReward(0, ticketId, signature);

        // 2nd claim with SAME ticketId reverts on duplicate ticket
        vm.expectRevert("Ticket already claimed");
        vm.prank(user);
        nexus.claimReward(0, ticketId, signature);
    }

    function test_MultipleClaimsWithDifferentTickets() public {
        vm.startPrank(creator);
        token.approve(address(nexus), 100 * 10 ** 18);
        nexus.createCampaign(
            token,
            100 * 10 ** 18,
            10 * 10 ** 18,
            "0g://metadata-hash",
            validator,
            address(this),
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            10
        );
        vm.stopPrank();

        uint256 balanceBefore = token.balanceOf(user);

        // Claim 1 with ticket-1
        {
            bytes32 ticketId1 = keccak256("user-action-1");
            bytes32 messageHash1 = keccak256(abi.encodePacked(uint256(0), user, ticketId1, address(nexus), block.chainid));
            bytes32 ethSignedMessageHash1 = MessageHashUtils.toEthSignedMessageHash(messageHash1);
            (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(validatorPrivateKey, ethSignedMessageHash1);
            bytes memory signature1 = abi.encodePacked(r1, s1, v1);
            
            vm.prank(user);
            nexus.claimReward(0, ticketId1, signature1);
        }

        // Claim 2 with ticket-2
        {
            bytes32 ticketId2 = keccak256("user-action-2");
            bytes32 messageHash2 = keccak256(abi.encodePacked(uint256(0), user, ticketId2, address(nexus), block.chainid));
            bytes32 ethSignedMessageHash2 = MessageHashUtils.toEthSignedMessageHash(messageHash2);
            (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(validatorPrivateKey, ethSignedMessageHash2);
            bytes memory signature2 = abi.encodePacked(r2, s2, v2);

            vm.prank(user);
            nexus.claimReward(0, ticketId2, signature2);
        }

        // Verify user successfully claimed twice
        assertEq(token.balanceOf(user), balanceBefore + 20 * 10 ** 18);
    }
}
