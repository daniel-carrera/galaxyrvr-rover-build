# Parts list

Prices are what we paid, where we recorded them. "Owned" means we already had the part.

| Part | Role | Qty | Paid |
|---|---|---:|---:|
| **Base** | | | |
| [SunFounder GalaxyRVR kit](https://docs.sunfounder.com/projects/galaxy-rvr/en/latest/) | Chassis, six TT motors, Arduino-compatible R3 board, GalaxyRVR shield, battery. Solar panel left off. | 1 | ≈ $130 |
| **Computer and power** | | | |
| [Raspberry Pi 5, 8 GB](https://www.raspberrypi.com/products/raspberry-pi-5/) | Records camera and lidar, relays drive commands | 1 | owned |
| Pi case base with active cooler | Cooling under load | 1 | owned |
| microSD card, 128 GB, A2 | Boot and storage. Our first card failed under continuous recording. | 1 | owned |
| [52Pi EP-0225 USB-C PD board](https://52pi.com/collections/hat-addons/products/52pi-pd-power-extension-adapter-board-for-raspberry-pi-5) | Takes 15 V USB-C PD, gives the Pi a regulated 5 V | 1 | $29.99 |
| [Anker MagGo A1664 power bank](https://www.anker.com/products/a1664-maggo-10000mah-power-bank) | The Pi's own battery, 39 Wh | 1 | owned |
| **Sensors** | | | |
| [Arducam B031202, 12 MP IMX708](https://www.arducam.com/12mp-imx708-autofocus-wide-angle-camera-module-3-for-raspberry-pi-hdr-mode-and-pdaf-supported.html) | Front camera, 120° diagonal, autofocus | 1 | $44.99 |
| [SLAMTEC RPLIDAR C1 kit](https://www.slamtec.com/en/c1/) | 360° single-plane lidar, with its USB adapter | 1 | $74.99 |
| **Printed and hardware** | | | |
| [Lower plate](cad/), PLA | Payload deck on the chassis | 1 | printed |
| [Lidar carrier](cad/), PLA | Raised lidar deck | 1 | printed |
| M3 metal standoffs, 45 mm stack, 5.6 mm hex | Lidar carrier supports | 4 | owned |
| M3 flat-head socket screws and nuts | Camera bracket (2) and standoff bases (4), pointing up from under the plate | 6 | owned |
| M3 screws and hex nuts | R3 board into captive nuts under the plate | 4 | owned |
| M3 screws | Plate to chassis (4), carrier to standoffs (4) | 8 | owned |
| M2.5 button-head socket screws | Pi, up through the plate into the EP-0225 standoffs | 4 | owned |
| M2.5 screws | Lidar to carrier from below, at most 4 mm into the lidar | 4 | owned |
| **Cables and control** | | | |
| USB-A to USB-B cable, [5 V wire cut](ASSEMBLY.md#the-usb-cable-we-cut) | Pi to R3 board: data and ground only | 1 | owned |
| PS4 DualShock 4 controller | Plugged into the laptop for driving | 1 | owned |
| **New parts bought for this build** | | | **≈ $280** |

Screw lengths were not recorded; measure against your own stack. Tools: a 3D printer (we used a Bambu Lab A1 mini),
a multimeter with a continuity beeper, and a USB power meter (POWER-Z KM003C).
