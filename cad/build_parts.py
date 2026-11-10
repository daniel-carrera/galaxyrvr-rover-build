"""Rebuild the rover's two printed PLA parts from the as-built specification.

Run with FreeCAD's command-line interpreter (tested with FreeCAD 1.1):

    freecadcmd cad/build_parts.py

Writes, relative to the repository root:

    cad/step/lower-plate.step, cad/step/lidar-carrier.step   assembly frame
    cad/stl/lower-plate.stl,   cad/stl/lidar-carrier.stl     print orientation
    docs/models/lower-plate.stl, docs/models/lidar-carrier.stl   assembly frame, for the web viewer

Every number below is copied from the build specification. Its plan view puts the origin at the lower
plate's front-right corner seen from above, with x increasing toward the rear and y toward the rover's left.
Seen from above with z up, that frame is left-handed, so features are placed with at(), which maps them
into a right-handed model frame: X = 179.5 - x points forward, Y = y points left, Z = 0 is the top face of
the lower plate and Z points up (the origin is the plate's rear-right top corner). Units are millimetres.
"""

import math
import os

import FreeCAD as App
import Mesh
import MeshPart
import Part

V = App.Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Lower plate ---------------------------------------------------------------------------------
PLATE = (179.5, 93.0, 7.0)  # X, Y, thickness; spans Z = -7 .. 0
CHANNEL_X = (69.45, 90.45)  # underside channel for the chassis strip, full width in Y
CHANNEL_DEPTH = 2.5
OPENING = dict(center=(165.55, 46.56), size=(10.0, 20.0), radius=2.0)  # cable pass-through
CENTRAL_BORE = dict(center=(80.45, 46.50), diameter=8.0)

CHASSIS_HOLES = [(172.8, 83.50), (172.8, 9.50), (42.3, 86.25), (42.3, 6.75)]  # M3 into the chassis
CHASSIS_BORE = 3.4

# M3 flat-head screws pointing up from the underside: camera bracket and lidar standoffs.
M3_BORE = 3.4
M3_CSK_DIAMETER = 6.15  # 90 degree included angle
CAMERA_HOLES = [(8.175, 65.95), (8.175, 37.05)]
STANDOFF_HOLES = [(104.55, 11.0), (154.55, 11.0), (104.55, 84.0), (154.55, 84.0)]

# Arduino-format R3 board: M3 from the top into captive nuts under the plate.
R3_HOLES = [(145.31, 75.90), (146.58, 27.64), (94.51, 60.66), (94.51, 32.72)]
R3_NUT_AF = 5.85  # across flats, two flats parallel to Y
R3_NUT_DEPTH = 2.6

# Raspberry Pi 5 + EP-0225: M2.5 button heads up from the underside into the EP-0225 standoffs.
PI_HOLES = [(35.13, 72.60), (35.13, 14.60), (84.13, 72.60), (84.13, 14.60)]
PI_BORE = 2.9
PI_POCKET_DIAMETER = 4.9
PI_POCKET_DEPTH = 1.9

# Lidar carrier ---------------------------------------------------------------------------------
CARRIER_X = (96.05, 165.05)
CARRIER_Y = (0.5, 92.5)
CARRIER_Z = (45.0, 49.0)  # 45 mm metal standoffs under it
LIDAR_HOLES = [(107.75, 24.0), (150.75, 24.0), (107.75, 67.0), (150.75, 67.0)]  # RPLIDAR C1, 43 x 43
LIDAR_BORE = 2.9

EPS = 0.01  # cutters overshoot faces so the booleans are clean


def at(x, y):
    """Specification plan coordinates -> model X (forward), Y (left)."""
    return PLATE[0] - x, y


def cylinder(x, y, diameter, z0, z1):
    return Part.makeCylinder(diameter / 2.0, z1 - z0, V(x, y, z0))


def countersink_from_below(x, y, z_bottom):
    """90 degree countersink opening downward: diameter M3_CSK_DIAMETER at the bottom face."""
    depth = (M3_CSK_DIAMETER - M3_BORE) / 2.0  # 90 degrees: radial change equals depth
    return Part.makeCone(M3_CSK_DIAMETER / 2.0 + EPS, M3_BORE / 2.0, depth + EPS, V(x, y, z_bottom - EPS))


def hex_prism(x, y, across_flats, z0, z1):
    """Hexagon with two flats parallel to Y (vertices on the +/-Y axis)."""
    r = across_flats / math.sqrt(3.0)
    pts = [V(x + r * math.cos(math.radians(a)), y + r * math.sin(math.radians(a)), z0) for a in range(30, 390, 60)]
    face = Part.Face(Part.makePolygon(pts))
    return face.extrude(V(0, 0, z1 - z0))


def rounded_rect(cx, cy, sx, sy, r, z0, z1):
    h = z1 - z0
    a = Part.makeBox(sx - 2 * r, sy, h, V(cx - sx / 2 + r, cy - sy / 2, z0))
    b = Part.makeBox(sx, sy - 2 * r, h, V(cx - sx / 2, cy - sy / 2 + r, z0))
    shape = a.fuse(b)
    for dx in (-1, 1):
        for dy in (-1, 1):
            shape = shape.fuse(cylinder(cx + dx * (sx / 2 - r), cy + dy * (sy / 2 - r), 2 * r, z0, z1))
    return shape.removeSplitter()


def lower_plate():
    sx, sy, t = PLATE
    zb, zt = -t, 0.0
    plate = Part.makeBox(sx, sy, t, V(0, 0, zb))
    channel_x0 = at(CHANNEL_X[1], 0)[0]
    cutters = [Part.makeBox(CHANNEL_X[1] - CHANNEL_X[0], sy + 2, CHANNEL_DEPTH + EPS, V(channel_x0, -1, zb - EPS))]

    o = OPENING
    cutters.append(rounded_rect(*at(*o["center"]), *o["size"], o["radius"], zb - 1, zt + 1))
    cutters.append(cylinder(*at(*CENTRAL_BORE["center"]), CENTRAL_BORE["diameter"], zb - 1, zt + 1))

    for p in CHASSIS_HOLES:
        cutters.append(cylinder(*at(*p), CHASSIS_BORE, zb - 1, zt + 1))
    for p in CAMERA_HOLES + STANDOFF_HOLES:
        cutters.append(cylinder(*at(*p), M3_BORE, zb - 1, zt + 1))
        cutters.append(countersink_from_below(*at(*p), zb))
    for p in R3_HOLES:
        cutters.append(cylinder(*at(*p), M3_BORE, zb - 1, zt + 1))
        cutters.append(hex_prism(*at(*p), R3_NUT_AF, zb - 1, zb + R3_NUT_DEPTH))
    for p in PI_HOLES:
        cutters.append(cylinder(*at(*p), PI_BORE, zb - 1, zt + 1))
        # Pockets under the channel start from the channel ceiling, not the plate bottom.
        floor = zb + CHANNEL_DEPTH if CHANNEL_X[0] <= p[0] <= CHANNEL_X[1] else zb
        cutters.append(cylinder(*at(*p), PI_POCKET_DIAMETER, floor - 1, floor + PI_POCKET_DEPTH))

    for c in cutters:
        plate = plate.cut(c)
    return plate.removeSplitter()


def lidar_carrier():
    (x0, x1), (y0, y1), (z0, z1) = CARRIER_X, CARRIER_Y, CARRIER_Z
    carrier = Part.makeBox(x1 - x0, y1 - y0, z1 - z0, V(at(x1, 0)[0], y0, z0))
    for p in STANDOFF_HOLES:
        carrier = carrier.cut(cylinder(*at(*p), M3_BORE, z0 - 1, z1 + 1))
    for p in LIDAR_HOLES:
        carrier = carrier.cut(cylinder(*at(*p), LIDAR_BORE, z0 - 1, z1 + 1))
    return carrier.removeSplitter()


def print_orientation(shape, flip):
    """Copy of the shape laid on the bed (Z = 0) with its footprint centred on the origin."""
    s = shape.copy()
    if flip:  # the lower plate prints top face down, pockets and channel facing up
        s.rotate(V(0, 0, 0), V(1, 0, 0), 180)
    bb = s.BoundBox
    s.translate(V(-(bb.XMin + bb.XMax) / 2.0, -(bb.YMin + bb.YMax) / 2.0, -bb.ZMin))
    return s


def write_stl(shape, path):
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=0.02, AngularDeflection=0.15, Relative=False)
    mesh.write(path)
    return mesh.CountFacets


def main():
    parts = {"lower-plate": (lower_plate(), True), "lidar-carrier": (lidar_carrier(), False)}
    for d in ("cad/step", "cad/stl", "docs/models"):
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)
    for name, (shape, flip) in parts.items():
        assert shape.isValid() and len(shape.Solids) == 1, name
        shape.exportStep(os.path.join(ROOT, "cad/step", name + ".step"))
        n_print = write_stl(print_orientation(shape, flip), os.path.join(ROOT, "cad/stl", name + ".stl"))
        write_stl(shape, os.path.join(ROOT, "docs/models", name + ".stl"))
        bb = shape.BoundBox
        print(f"{name}: {bb.XLength:.2f} x {bb.YLength:.2f} x {bb.ZLength:.2f} mm, "
              f"volume {shape.Volume / 1000:.1f} cm3, {n_print} facets")


main()
