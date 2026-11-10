# Printed parts

| File | Part | Notes |
|---|---|---|
| `stl/lower-plate.stl` | Lower plate, 179.5 × 93 × 7 mm | Print orientation: top face on the bed |
| `stl/lidar-carrier.stl` | Lidar carrier, 69 × 92 × 4 mm | Print flat |
| `step/*.step` | Both parts | Assembly frame, for editing in any CAD tool |

PLA, 4 wall loops, 15 % gyroid infill, slicer modifiers at every through-hole.

The files are rebuilt from the build's measured specification by `build_parts.py`; every dimension in it is copied
from that specification. The original slicer project is not included. To rebuild (FreeCAD 1.1):

```bash
freecadcmd cad/build_parts.py
```

That also writes the assembly-frame STL files the project page's 3D view loads, in `docs/models/`.

Model frame: X forward, Y toward the rover's left, Z up, Z = 0 on the plate's top face.

Known limits of this design, kept as built:

- The camera bracket holes are the ones we re-drilled 5 mm along the plate's width, after printing, to clear the
  Pi's power cable. The original print had them 5 mm the other way.
- Two walls are thinner than our own 2.5 and 3 mm minimums: between two R3 nut pockets and the channel (1.1 mm), and
  the roof over two Pi screw pockets inside the channel (2.6 mm).
- No heat-set inserts: captive M3 nuts, countersunk M3 screws from below, and the EP-0225's own standoffs.
