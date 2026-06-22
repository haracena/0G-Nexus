// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @dev A simple ERC20 token for testing purposes on the 0G Newton Testnet.
 * Anyone can mint tokens to their address for testing.
 */
contract MockERC20 is ERC20, Ownable {
    constructor() ERC20("Mock A0GI Token", "mA0GI") Ownable(msg.sender) {}

    /**
     * @notice Allows anyone to mint tokens for testing.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
