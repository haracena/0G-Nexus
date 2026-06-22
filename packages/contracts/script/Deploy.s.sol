// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Nexus} from "../src/Nexus.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Nexus nexus = new Nexus();

        console.log("Nexus deployed to:", address(nexus));

        vm.stopBroadcast();
    }
}
