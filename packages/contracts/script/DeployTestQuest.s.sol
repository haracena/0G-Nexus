// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TestQuest} from "../src/TestQuest.sol";

contract DeployTestQuestScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        TestQuest testQuest = new TestQuest();

        console.log("TestQuest deployed to:", address(testQuest));

        vm.stopBroadcast();
    }
}
