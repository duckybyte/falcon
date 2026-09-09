# Falcon V1.0.0

A high performance, stable, low-latency custom client for MooMoo.io. 
Built from the ground up, the client offers high-level automation features as well as QoL improvements. 
With over 50+ toggles, the client offers customization for all play styles.

## Installation
For those who don't care about the code, simply go to **Releases** page and download the unpacked extension for your preferred version. 
It is the only place to install and download the safe extension for the client.
> For a tutorial of how to load unpacked extensions, go to **YouTube** and search for "how to load unpacked extension in chrome" and pick any video that pops up.

Below are the instructions to download a local copy of the client.
### Prerequisites
- Node.js
- NPM
- Terminal
- Working Keyboard
- 3 Micro Braincells

### Installation Instructions
1. Fork / Clone the entire repo
2. Run ```npm install``` to install all dependencies
3. Run ```npm run ext:build``` to build dev extension build.
4. Load the generated dist directory into chrome extensions.
5. Run ```npm run mod:watch``` or ```npm run mod:build``` to actually bundle and build the mod code.
6. Run ```npm run dev:start``` to start the local backend that the dev extension requires.

## Contribution / Code Modification
This specific project is **NOT** opened to community contributions.

## Client Guide / Information
This client requires you to have a reasonable ping/latency.
Don't expect anything to work perfectly when you have 912381032910 ms.
80ms should be the highest if you want reasonable performance.

### Client Controls
- ESC: Toggle Menu
- WASD Keys: Movement
- R: Toggle ATOS/Auto Instakill
- T: Toggle One Tick Tap Mode
- V: Spike placement
- H: Teleport/turret placement
- K: Spawnpad placement
- F: Trap placement
> You should not need to use any of the placement macros during real fights.

### Server Selection
The client, by default, only allows you to select from sandbox servers.
This is intentional, this is a sandbox-only client.

## Client Features
Brief list of all the client's features:
- Auto Healing
    - "if it isn't 100+ damage in one tick, it is healable" - duckman
- Auto Placement
    - Includes replacer and preplacer
    - Uses deterministic physics simulation to grade placement angles
- Dynamic/Velocity One Tick
- Knockback Attacks (and Instakills)
    - Uses deterministic physics simulation
- Auto Push (with Pathfinding)
- Auto Respawn
- Packet Management System
    - Never packet-spam / get rate limited!
- Packet Recorder and Replayer
- Apple Insta / Spike Tick / Shame Grind
- Projectile Syncs
    - Melee hit sync with any traveling projectile for a perfect onetick kill

## License
This project is licensed under GNU GPLv3.
> For more information about **GNU GPLv3**, click [here](https://choosealicense.com/licenses/gpl-3.0/).