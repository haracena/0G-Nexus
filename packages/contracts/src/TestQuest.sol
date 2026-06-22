// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TestQuest
 * @dev A mock contract to test incentivized actions like staking, swapping, and minting.
 */
contract TestQuest {
    event Staked(address indexed user, uint256 amount);
    event SwapCompleted(address indexed user, uint256 amountIn, uint256 amountOut);
    event Minted(address indexed user, uint256 tokenId);

    uint256 public nextTokenId;

    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        emit Staked(msg.sender, amount);
    }

    function swap(uint256 amountIn, uint256 minAmountOut) external {
        require(amountIn > 0, "AmountIn must be > 0");
        // Simulate a 1% slippage swap
        uint256 amountOut = (amountIn * 99) / 100;
        require(amountOut >= minAmountOut, "Slippage too high");
        emit SwapCompleted(msg.sender, amountIn, amountOut);
    }

    function mint() external {
        uint256 tokenId = nextTokenId++;
        emit Minted(msg.sender, tokenId);
    }
}
