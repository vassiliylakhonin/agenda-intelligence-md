// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/M2MEscrow.sol";

contract MockUSDC is IERC20 {
    string public name = "USD Coin (Mock)";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        totalSupply += amount;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        require(_balances[msg.sender] >= value, "Insufficient balance");
        _balances[msg.sender] -= value;
        _balances[to] += value;
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _allowances[msg.sender][spender] = value;
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        require(_balances[from] >= value, "Insufficient balance");
        if (msg.sender != from) {
            uint256 allowed = _allowances[from][msg.sender];
            require(allowed >= value, "Insufficient allowance");
            if (allowed != type(uint256).max) {
                _allowances[from][msg.sender] -= value;
            }
        }
        _balances[from] -= value;
        _balances[to] += value;
        return true;
    }
}
