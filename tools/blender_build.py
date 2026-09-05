"""
LaxFoo Racing — Blender asset pipeline.

Builds high-fidelity vehicle, driver, and crosse models procedurally in Blender
(bevels, subdivision, booleans, curves, displacement) and exports GLBs whose node
and material names match what js/game.js expects:

  nodes:      body, wheel_frontLeft, wheel_frontRight, wheel_backLeft, wheel_backRight,
              seat (empty), stickMount (empty)
  materials:  paint, roof, window, lightFront, lightBack, carTire, rim, trim, chrome, ...
              driver: jersey, helmet, skin, pads, gloves, mask — stick: shaft, pocket, net

Run (headless, via the `bpy` pip module):
    python3 tools/blender_build.py --out build/models [--render]
"""
import bpy, bmesh, math, os, sys, argparse
from mathutils import Vector, Matrix

# ------------------------------------------------------------------ helpers
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'

def ctx_override(obj, extra=None):
    d = dict(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj])
    if extra: d.update(extra)
    return bpy.context.temp_override(**d)

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj

MATS = {}
def mat(name, color, metallic=0.0, roughness=0.5, alpha=1.0, emission=None, emit_strength=1.0,
        coat=0.0, coat_rough=0.05, sheen=0.0, sheen_rough=0.4, ior=1.45):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    for k, v in (("Coat Weight", coat), ("Coat Roughness", coat_rough), ("Sheen Weight", sheen), ("Sheen Roughness", sheen_rough), ("IOR", ior)):
        if k in bsdf.inputs: bsdf.inputs[k].default_value = v
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        if hasattr(m, "surface_render_method"): m.surface_render_method = 'BLENDED'
        if hasattr(m, "blend_method"): m.blend_method = 'BLEND'
    MATS[name] = m
    return m

def std_mats():
    return dict(
        paint  = mat("paint",  (0.72, 0.08, 0.08), 0.65, 0.28, coat=1.0, coat_rough=0.06),
        roof   = mat("roof",   (0.92, 0.93, 0.94), 0.40, 0.35, coat=0.8, coat_rough=0.08),
        window = mat("window", (0.10, 0.16, 0.22), 0.85, 0.06, alpha=0.5, ior=1.52),
        lf     = mat("lightFront", (1.0, 0.96, 0.85), 0.0, 0.25, emission=(1.0, 0.95, 0.8), emit_strength=1.5),
        lb     = mat("lightBack",  (0.85, 0.08, 0.06), 0.0, 0.3, emission=(0.9, 0.05, 0.03), emit_strength=1.2),
        tire   = mat("carTire", (0.07, 0.075, 0.08), 0.0, 0.92),
        rim    = mat("rim",     (0.78, 0.80, 0.83), 0.92, 0.28),
        trim   = mat("trim",    (0.10, 0.11, 0.12), 0.05, 0.75),
        chrome = mat("chrome",  (0.90, 0.92, 0.94), 0.98, 0.12),
        canvas = mat("canvas",  (0.62, 0.50, 0.32), 0.0, 0.95, sheen=0.6, sheen_rough=0.5),
        seat   = mat("seatCloth", (0.18, 0.19, 0.22), 0.0, 0.85, sheen=0.3),
        rubber = mat("rubberTrim", (0.05, 0.05, 0.06), 0.0, 0.85),
        grille = mat("grille",  (0.06, 0.06, 0.07), 0.3, 0.55),
        glassRed = mat("lightBack", (0.85, 0.08, 0.06)),
    )

def new_mesh_obj(name, bm, material=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    link(ob)
    if material: ob.data.materials.append(material)
    return ob

def set_smooth(ob, on=True):
    for p in ob.data.polygons: p.use_smooth = on

def bevel(ob, width=0.03, segs=3, angle=40, harden=True):
    m = ob.modifiers.new("bevel", 'BEVEL')
    m.width = width; m.segments = segs
    m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle)
    m.harden_normals = harden
    m.miter_outer = 'MITER_ARC'
    return m

def subsurf(ob, levels=2):
    m = ob.modifiers.new("sub", 'SUBSURF'); m.levels = levels; m.render_levels = levels
    return m

def apply_all(ob):
    with ctx_override(ob):
        for m in list(ob.modifiers):
            try: bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception as e: print("modifier apply failed", ob.name, m.name, e)

def boolean_cut(ob, cutter, op='DIFFERENCE'):
    m = ob.modifiers.new("bool", 'BOOLEAN'); m.operation = op; m.object = cutter
    m.solver = 'EXACT'
    return m

def rbox(name, size, loc, material, bev=0.02, segs=2, rot=(0,0,0), smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = new_mesh_obj(name, bm, material)
    ob.location = loc; ob.rotation_euler = rot
    if bev > 0:
        mn = min(size) / 2.2
        bevel(ob, width=min(bev, mn), segs=segs)
    set_smooth(ob, smooth)
    return ob

def cylinder(name, r, depth, loc, material, axis='Z', segs=32, bev=0.0, r2=None, rot_extra=(0,0,0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r, radius2=(r2 if r2 is not None else r), depth=depth)
    if axis == 'X': bmesh.ops.rotate(bm, cent=(0,0,0), matrix=Matrix.Rotation(math.radians(90), 3, 'Y'), verts=bm.verts)
    if axis == 'Y': bmesh.ops.rotate(bm, cent=(0,0,0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'), verts=bm.verts)
    ob = new_mesh_obj(name, bm, material)
    ob.location = loc; ob.rotation_euler = rot_extra
    if bev > 0: bevel(ob, width=bev, segs=3)
    set_smooth(ob, True)
    return ob

def torus(name, R, r, loc, material, axis='Z', segs=32, rsegs=12, rot=(0,0,0)):
    bm = bmesh.new()
    verts = []
    for i in range(segs):
        a = 2*math.pi*i/segs
        ring = []
        for j in range(rsegs):
            b = 2*math.pi*j/rsegs
            x = (R + r*math.cos(b))*math.cos(a); y = (R + r*math.cos(b))*math.sin(a); z = r*math.sin(b)
            ring.append(bm.verts.new((x,y,z)))
        verts.append(ring)
    for i in range(segs):
        for j in range(rsegs):
            a=verts[i][j]; b=verts[(i+1)%segs][j]; c=verts[(i+1)%segs][(j+1)%rsegs]; d=verts[i][(j+1)%rsegs]
            bm.faces.new((a,b,c,d))
    bm.normal_update()
    if axis == 'X': bmesh.ops.rotate(bm, cent=(0,0,0), matrix=Matrix.Rotation(math.radians(90), 3, 'Y'), verts=bm.verts)
    if axis == 'Y': bmesh.ops.rotate(bm, cent=(0,0,0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'), verts=bm.verts)
    ob = new_mesh_obj(name, bm, material)
    ob.location = loc; ob.rotation_euler = rot
    set_smooth(ob, True)
    return ob

def tube_from_points(name, pts, radius, material, res=8, smooth_path=True):
    cu = bpy.data.curves.new(name + "_c", 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER' if smooth_path else 'POLY')
    if smooth_path:
        sp.bezier_points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            bp = sp.bezier_points[i]; bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    else:
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts): sp.points[i].co = (*p, 1.0)
    cu.bevel_depth = radius; cu.bevel_resolution = 3; cu.resolution_u = res
    cu.fill_mode = 'FULL'; cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu); link(ob)
    with ctx_override(ob): bpy.ops.object.convert(target='MESH')
    ob = bpy.data.objects[name]
    ob.data.materials.append(material); set_smooth(ob, True)
    return ob

def profile_extrude(name, profile_yz, width, material, bev=0.05, segs=3):
    """Extrude a side-view polygon (y,z) across X to make a car body shell."""
    bm = bmesh.new()
    vs = [bm.verts.new((-width/2, y, z)) for (y, z) in profile_yz]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    ext_verts = [g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(width, 0, 0), verts=ext_verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_mesh_obj(name, bm, material)
    bevel(ob, width=bev, segs=segs, angle=35)
    set_smooth(ob, True)
    return ob

def box_uv(ob, size=1.0):
    """Cube-project UVs at `size` meters per tile so runtime detail textures tile in world scale."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal; ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for l in f.loops:
            c = l.vert.co
            if az >= ax and az >= ay: u, v = c.x, c.y
            elif ax >= ay: u, v = c.y, c.z
            else: u, v = c.x, c.z
            l[uv].uv = (u / size, v / size)
    bm.to_mesh(ob.data); bm.free()
    return ob

def join(objs, name):
    objs = [o for o in objs if o is not None]
    tgt = objs[0]
    with bpy.context.temp_override(object=tgt, active_object=tgt, selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    tgt.name = name
    box_uv(tgt)
    return tgt

def empty(name, loc):
    """Marker node: a tiny triangle mesh (empties get pruned by optimizers)."""
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((0,0,0),(0.001,0,0),(0,0.001,0))]
    bm.faces.new(v)
    ob = new_mesh_obj(name, bm, mat("marker", (0,0,0)))
    ob.location = loc
    return ob

def delete(ob):
    bpy.data.objects.remove(ob, do_unlink=True)

# ------------------------------------------------------------------ wheel
def build_wheel(name, loc, R=0.38, W=0.26, M=None, spokes=5, side=0):
    """Treaded tire + spoked alloy + hub + lug nuts. Axle = local X. Origin at center. Symmetric so one mesh serves every wheel."""
    parts = []
    tire = cylinder(name+"_tire", R, W, (0,0,0), M["tire"], axis='X', segs=40, bev=0.06)
    parts.append(tire)
    n = 22
    for i in range(n):
        a = 2*math.pi*i/n
        lug = rbox(name+"_lug%d"%i, (W*0.80, 0.055, 0.02), (0, 0, 0), M["tire"], bev=0, smooth=False)
        lug.location = (0, -(R+0.004)*math.sin(a), (R+0.004)*math.cos(a))
        lug.rotation_euler = (a, 0, 0)
        parts.append(lug)
    for sgn in (1,-1):
        rim = cylinder(name+"_rim%d"%(sgn+1), R*0.60, W*0.30, (sgn*W*0.30,0,0), M["rim"], axis='X', segs=32, bev=0.012)
        parts.append(rim)
        dish = cylinder(name+"_dish%d"%(sgn+1), R*0.50, W*0.36, (sgn*W*0.22,0,0), M["trim"], axis='X', segs=32)
        parts.append(dish)
        for i in range(spokes):
            a = 2*math.pi*i/spokes
            sp = rbox(name+"_spoke%d%d"%(sgn+1,i), (W*0.20, 0.075, R*0.50), (0,0,0), M["rim"], bev=0.01, segs=1)
            sp.location = (sgn*W*0.36, -math.sin(a)*R*0.27, math.cos(a)*R*0.27)
            sp.rotation_euler = (a, 0, 0)
            parts.append(sp)
        hub = cylinder(name+"_hub%d"%(sgn+1), R*0.17, W*0.18, (sgn*W*0.42,0,0), M["rim"], axis='X', segs=20, bev=0.008)
        parts.append(hub)
        for i in range(spokes):
            a = 2*math.pi*i/spokes + math.pi/spokes
            nut = cylinder(name+"_nut%d%d"%(sgn+1,i), 0.016, 0.02, (sgn*W*0.51, -math.sin(a)*R*0.11, math.cos(a)*R*0.11), M["chrome"], axis='X', segs=6)
            parts.append(nut)
    for p in parts: apply_all(p)
    wheel = join(parts, name)
    wheel.location = loc
    return wheel

def instance_wheel(src, name, loc):
    ob = bpy.data.objects.new(name, src.data); ob.location = loc; link(ob); return ob

# ------------------------------------------------------------------ vehicle
def build_vehicle(spec, M):
    """spec: dict(L, W, wb, R, hoodH, roofH, cab=(y0,y1), style, ...)."""
    L, W, wb, R = spec["L"], spec["W"], spec["wb"], spec["R"]
    hoodH, roofH = spec["hoodH"], spec["roofH"]
    cab0, cab1 = spec["cab"]           # y range of the greenhouse (rear .. front)
    rake = spec.get("rake", 0.45)       # windshield horizontal run
    belt = spec.get("belt", 1.05)       # beltline height
    floor = 0.42
    yr, yf = -L/2, L/2
    style = spec["style"]
    parts = []

    # --- body silhouette (side view, counter-clockwise), then extrude across width
    prof = [(yr, floor), (yr+0.05, belt)]
    if style in ("wagon", "modern", "rover"):
        if style == "rover":
            prof += [(yr+0.12, roofH+0.06), (cab0+ (cab1-cab0)*0.55, roofH+0.06), (cab0+(cab1-cab0)*0.55, roofH)]
        else:
            prof += [(yr+0.18, roofH)]
        prof += [(cab1 - rake, roofH), (cab1, hoodH+0.13), (cab1+0.12, hoodH)]
    elif style in ("halfcab", "soft"):
        prof += [(cab0-0.03, belt+0.05), (cab0, belt+0.05), (cab0, roofH), (cab1 - rake, roofH), (cab1, hoodH+0.13), (cab1+0.12, hoodH)]
    elif style == "open":
        prof += [(cab1, belt), (cab1+0.05, hoodH)]
    prof += [(yf-0.10, hoodH-0.02), (yf, hoodH-0.14), (yf, floor)]
    body = profile_extrude("shell", prof, W, M["paint"], bev=spec.get("bev", 0.05))
    parts.append(body)

    # wheel arches
    ax = [ (wb/2, 1), (wb/2, -1), (-wb/2, 1), (-wb/2, -1) ]
    cutters = []
    for i,(y,s) in enumerate(ax):
        c = cylinder("arch%d"%i, R+0.09, 0.9, (s*W/2, y, R), None, axis='X', segs=40)
        c.hide_render = True
        boolean_cut(body, c); cutters.append(c)
    # arch cut wheel wells then chassis undertray
    apply_all(body)
    for c in cutters: delete(c)
    parts.append(rbox("undertray", (W-0.35, L-0.6, 0.12), (0, 0, floor-0.02), M["trim"], bev=0.02))

    # fender flares
    if spec.get("flares", True):
        for i,(y,s) in enumerate(ax):
            fl = torus("flare%d"%i, R+0.13, 0.055, (s*(W/2+0.01), y, R), M["trim"] if spec.get("blackFlares", True) else M["paint"], axis='X', segs=28, rsegs=6)
            # keep only upper half: cut with a box below axle height
            cut = rbox("flarecut%d"%i, (0.6, 1.4, 0.6), (s*(W/2+0.01), y, R-0.32), None, bev=0)
            boolean_cut(fl, cut); apply_all(fl); delete(cut)
            parts.append(fl)

    # glass
    g = M["window"]
    gz0, gz1 = belt+0.28, roofH-0.10
    if style != "open":
        # windshield (tilted quad box)
        wl = math.hypot(rake, roofH-(hoodH+0.13)); ang = math.atan2(roofH-(hoodH+0.13), rake)
        ws = rbox("windshield", (W-0.30, 0.02, wl-0.10), (0, cab1 - rake/2 - 0.005, (roofH + hoodH+0.13)/2 + 0.02), g, bev=0.008)
        ws.rotation_euler = (math.pi/2 - ang, 0, 0)
        parts.append(ws)
        # side windows (two per side, with a B-pillar gap)
        span = (cab1 - rake) - cab0
        for s in (1,-1):
            for k,(a,b) in enumerate([(0.02,0.48),(0.54,0.98)]):
                y0 = cab0 + span*a; y1 = cab0 + span*b
                if style in ("halfcab","soft") and k==0: continue
                parts.append(rbox("sidewin%d%d"%(k,s+1), (0.02, y1-y0, gz1-gz0), (s*(W/2+0.004), (y0+y1)/2, (gz0+gz1)/2), g, bev=0.02))
        if style in ("wagon","modern","rover"):
            parts.append(rbox("rearwin", (W-0.34, 0.02, roofH-0.12-(belt+0.26)), (0, yr+0.03, (roofH-0.12+belt+0.26)/2), g, bev=0.02))
    else:
        # fold-flat windshield frame + glass
        fr = rbox("wsframe", (W-0.22, 0.05, 0.62), (0, cab1-0.08, hoodH+0.30), M["paint"], bev=0.01)
        fr.rotation_euler = (math.radians(-12), 0, 0); parts.append(fr)
        gl = rbox("wsglass", (W-0.36, 0.015, 0.46), (0, cab1-0.085, hoodH+0.31), g, bev=0.004)
        gl.rotation_euler = (math.radians(-12), 0, 0); parts.append(gl)

    # roof (two-tone panel) & rack
    if style in ("wagon","modern","rover","halfcab","soft"):
        ry0 = yr+0.20 if style in ("wagon","modern","rover") else cab0+0.02
        ry1 = cab1 - rake - 0.02
        rz = roofH + (0.06 if style=="rover" else 0.0)
        parts.append(rbox("roofpanel", (W-0.16, ry1-ry0, 0.05), (0, (ry0+ry1)/2, rz+0.01), M["roof"], bev=0.02))
        if spec.get("rack"):
            for s in (1,-1):
                parts.append(tube_from_points("rail%d"%(s+1), [(s*(W/2-0.16), ry0+0.08, rz+0.12),(s*(W/2-0.16), ry1-0.08, rz+0.12)], 0.02, M["trim"], smooth_path=False))
                for yy in (ry0+0.1, ry1-0.1):
                    parts.append(cylinder("railpost", 0.018, 0.09, (s*(W/2-0.16), yy, rz+0.07), M["trim"], segs=10))
            for yy in (ry0+0.35, ry1-0.35):
                parts.append(tube_from_points("crossbar", [(-(W/2-0.16), yy, rz+0.15), ((W/2-0.16), yy, rz+0.15)], 0.017, M["trim"], smooth_path=False))

    # open bed / soft top
    if style in ("halfcab","soft"):
        # bed side walls & tailgate, floor
        parts.append(rbox("bedfloor", (W-0.14, cab0-yr-0.12, 0.05), (0, (yr+cab0)/2, belt-0.35), M["trim"], bev=0.01))
        for s in (1,-1):
            parts.append(rbox("bedwall%d"%(s+1), (0.05, cab0-yr-0.1, 0.34), (s*(W/2-0.05), (yr+cab0)/2, belt-0.12), M["paint"], bev=0.01))
        if style == "soft":
            # roll bar (arch) + folded canvas top at the tailgate
            rb = tube_from_points("rollbar", [(-(W/2-0.22), cab0-0.12, belt-0.3), (-(W/2-0.22), cab0-0.12, roofH-0.05), (0, cab0-0.12, roofH+0.02), ((W/2-0.22), cab0-0.12, roofH-0.05), ((W/2-0.22), cab0-0.12, belt-0.3)], 0.032, M["trim"])
            parts.append(rb)
            canvas = rbox("softtop", (W-0.3, 0.55, 0.30), (0, yr+0.42, belt+0.08), M["canvas"], bev=0.06, segs=4)
            subsurf(canvas, 2)
            tex = bpy.data.textures.new("cloth", 'CLOUDS'); tex.noise_scale = 0.09; tex.noise_depth = 2
            d = canvas.modifiers.new("wrinkle", 'DISPLACE'); d.texture = tex; d.strength = 0.045; d.mid_level = 0.5
            parts.append(canvas)
            for k in range(3):
                parts.append(tube_from_points("strap%d"%k, [(-(W/2-0.3)+k*(W-0.6)/2, yr+0.14, belt+0.26), (-(W/2-0.3)+k*(W-0.6)/2, yr+0.70, belt+0.26)], 0.012, M["rubber"], smooth_path=False))
    if style == "open":
        # exposed cabin: seats, dash, hoops, flat fenders
        for s in (0.42, -0.42):
            parts.append(rbox("seatbase", (0.44, 0.48, 0.12), (s, cab0+0.55, belt-0.30), M["seat"], bev=0.04))
            parts.append(rbox("seatback", (0.44, 0.10, 0.50), (s, cab0+0.30, belt-0.02), M["seat"], bev=0.04))
        parts.append(rbox("dash", (W-0.3, 0.25, 0.22), (0, cab1-0.32, belt-0.05), M["trim"], bev=0.03))
        rb = tube_from_points("hoop", [(-(W/2-0.25), cab0+0.05, belt-0.1), (-(W/2-0.25), cab0+0.05, belt+0.62), ((W/2-0.25), cab0+0.05, belt+0.62), ((W/2-0.25), cab0+0.05, belt-0.1)], 0.03, M["trim"])
        parts.append(rb)
        for (y,s) in ax:
            parts.append(rbox("flatfender", (0.24, 0.95, 0.05), (s*(W/2+0.06), y, R+0.30), M["paint"], bev=0.015))

    # seats + steering wheel for closed cabs (seen through glass)
    if style != "open":
        for s in (0.40, -0.40):
            parts.append(rbox("seatbase", (0.44, 0.48, 0.12), (s, cab0+ (cab1-cab0)*0.42, belt-0.28), M["seat"], bev=0.04))
            parts.append(rbox("seatback", (0.44, 0.10, 0.52), (s, cab0+ (cab1-cab0)*0.42-0.22, belt), M["seat"], bev=0.04))
        parts.append(rbox("dash", (W-0.3, 0.28, 0.20), (0, cab1-0.36, belt-0.05), M["trim"], bev=0.03))
    sw = torus("steeringwheel", 0.17, 0.018, (-0.40, cab1-0.52 if style!="open" else cab1-0.45, belt+0.12), M["trim"], axis='Y', segs=28, rsegs=8)
    sw.rotation_euler = (math.radians(-25), 0, 0); parts.append(sw)
    parts.append(cylinder("swcol", 0.02, 0.28, (-0.40, cab1-0.42 if style!="open" else cab1-0.35, belt+0.02), M["trim"], axis='Y', segs=10, rot_extra=(math.radians(-25),0,0)))

    # bumpers, grille, lights
    bh = floor + 0.22
    parts.append(rbox("bumperF", (W-0.06, 0.12, 0.16), (0, yf+0.02, bh), M["chrome"] if spec.get("chromeBumpers", True) else M["trim"], bev=0.03))
    parts.append(rbox("bumperR", (W-0.06, 0.12, 0.16), (0, yr-0.02, bh), M["chrome"] if spec.get("chromeBumpers", True) else M["trim"], bev=0.03))
    gh = (hoodH - 0.14 - bh - 0.10)
    parts.append(rbox("grille", (W*0.52, 0.04, gh), (0, yf+0.005, bh+0.10+gh/2), M["grille"], bev=0.01))
    nslots = 7 if spec.get("jeepGrille") else 4
    for i in range(nslots):
        xx = -W*0.22 + i*(W*0.44)/(nslots-1)
        parts.append(rbox("slot%d"%i, (0.03 if spec.get("jeepGrille") else W*0.5, 0.02, gh-0.06 if spec.get("jeepGrille") else 0.02),
                          (xx if spec.get("jeepGrille") else 0, yf+0.03, bh+0.10+gh/2 if spec.get("jeepGrille") else bh+0.12+i*(gh-0.06)/(nslots-1)), M["chrome"], bev=0.004))
    lz = bh + 0.10 + gh*0.62
    for s in (1,-1):
        if spec.get("roundLights"):
            parts.append(cylinder("bezel", 0.13, 0.04, (s*(W/2-0.30), yf+0.01, lz), M["chrome"], axis='Y', segs=32))
            parts.append(cylinder("headlight", 0.105, 0.05, (s*(W/2-0.30), yf+0.025, lz), M["lf"], axis='Y', segs=32))
        else:
            parts.append(rbox("bezel", (0.30, 0.04, 0.15), (s*(W/2-0.30), yf+0.01, lz), M["trim"], bev=0.01))
            parts.append(rbox("headlight", (0.25, 0.05, 0.11), (s*(W/2-0.30), yf+0.025, lz), M["lf"], bev=0.01))
        parts.append(rbox("taillight", (0.10, 0.04, 0.26), (s*(W/2-0.10), yr-0.005, belt-0.16), M["lb"], bev=0.01))
        parts.append(rbox("indicator", (0.16, 0.04, 0.06), (s*(W/2-0.34), yf+0.02, bh+0.14), M["lf"], bev=0.005))
        # mirrors
        parts.append(rbox("mirrorstalk", (0.10, 0.03, 0.03), (s*(W/2+0.05), cab1-rake*0.15, belt+0.32), M["trim"], bev=0.005))
        parts.append(rbox("mirror", (0.05, 0.16, 0.11), (s*(W/2+0.12), cab1-rake*0.15, belt+0.34), M["trim"], bev=0.012))
        # door seams + handles
        if style != "open":
            seams = [cab0 + (cab1-cab0-rake)*0.5] if style in ("halfcab","soft") else [cab0 + (cab1-cab0-rake)*0.5, cab0-0.02]
            for j,yy in enumerate(seams):
                parts.append(rbox("seam%d%d"%(j,s+1), (0.012, 0.012, belt-floor+0.55), (s*(W/2+0.002), yy, (floor+belt+0.55)/2), M["rubber"], bev=0))
                parts.append(rbox("handle%d%d"%(j,s+1), (0.03, 0.14, 0.035), (s*(W/2+0.012), yy+0.16, belt+0.10), M["chrome"], bev=0.008))
        # side steps
        if spec.get("steps"):
            parts.append(rbox("step%d"%(s+1), (0.14, wb-0.6, 0.05), (s*(W/2+0.05), 0, floor-0.06), M["trim"], bev=0.015))
    # snorkel
    if spec.get("snorkel"):
        parts.append(tube_from_points("snorkel", [(W/2+0.04, cab1-0.1, hoodH-0.2), (W/2+0.04, cab1-0.05, roofH-0.35), (W/2+0.04, cab1-0.35, roofH-0.05)], 0.045, M["trim"]))
        parts.append(rbox("snorkelhead", (0.13, 0.22, 0.10), (W/2+0.04, cab1-0.42, roofH-0.02), M["trim"], bev=0.02))
    # antenna, exhaust, tow hooks
    parts.append(cylinder("antenna", 0.006, 0.55, (W/2-0.12, cab1-0.15, hoodH+0.28), M["trim"], segs=8))
    parts.append(cylinder("exhaust", 0.035, 0.18, (W/2-0.30, yr-0.05, floor-0.02), M["chrome"], axis='Y', segs=14))
    for s in (1,-1):
        parts.append(rbox("towhook", (0.05, 0.08, 0.05), (s*0.3, yf+0.03, floor-0.02), M["trim"], bev=0.01))
    # spare tire on the tailgate
    for p in parts: apply_all(p)
    body_ob = join(parts, "body")

    # wheels: one mesh, instanced
    wheels = {}
    tw = W/2 - 0.02
    first = build_wheel("wheel_frontRight", (tw, wb/2, R), R=R, W=spec.get("tireW", 0.26), M=M)
    wheels["wheel_frontRight"] = first
    for name,(y,s) in [("wheel_frontLeft",(wb/2,-1)),("wheel_backRight",(-wb/2,1)),("wheel_backLeft",(-wb/2,-1))]:
        wheels[name] = instance_wheel(first, name, (s*tw, y, R))
    if spec.get("spare"):
        sp = instance_wheel(first, "spare", (0.25 if style!="open" else 0.0, yr-0.16, belt-0.05))
        sp.rotation_euler = (0, 0, math.radians(90))
        sp.parent = body_ob
        sp.matrix_parent_inverse = body_ob.matrix_world.inverted()

    # driver seat + stick mount markers for the runtime
    empty("seat", (-0.40, (cab0 + (cab1-cab0)*0.42) if style!="open" else cab0+0.55, belt-0.22))
    empty("stickMount", (W/2+0.05, cab1-0.2, belt+0.35))
    return body_ob, wheels

# ------------------------------------------------------------------ driver
def skeleton(seated, hz):
    """Joint positions + skin radii shared by the body and its garments."""
    if seated:
        elbow = lambda s: (s*0.25, 0.17, hz+0.33); wrist = lambda s: (s*0.16, 0.37, hz+0.45)
        knee  = lambda s: (s*0.14, 0.40, hz+0.02); ankle = lambda s: (s*0.14, 0.50, hz-0.31); toe = lambda s: (s*0.14, 0.64, hz-0.35)
    else:
        elbow = lambda s: (s*0.27, 0.05, hz+0.26); wrist = lambda s: (s*0.25, 0.15, hz+0.04)
        knee  = lambda s: (s*0.12, 0.02, hz-0.45); ankle = lambda s: (s*0.12, 0.02, hz-0.90); toe = lambda s: (s*0.12, 0.17, hz-0.93)
    P = {  # name: (position, radius)
        "hips": ((0, 0, hz), 0.145), "spine": ((0, 0.01, hz+0.20), 0.135), "chest": ((0, 0.02, hz+0.42), 0.165),
        "neck": ((0, 0.02, hz+0.58), 0.055), "head": ((0, 0.03, hz+0.73), 0.105),
    }
    for s, tag in ((1,"R"),(-1,"L")):
        P["sh"+tag] = ((s*0.21, 0.01, hz+0.50), 0.072); P["el"+tag] = (elbow(s), 0.057); P["wr"+tag] = (wrist(s), 0.046)
        P["hp"+tag] = ((s*0.11, 0.0, hz-0.03), 0.095); P["kn"+tag] = (knee(s), 0.076); P["an"+tag] = (ankle(s), 0.054); P["to"+tag] = (toe(s), 0.046)
    return P

def mix(a, b, t):
    return tuple(a[i] + (b[i]-a[i])*t for i in range(3))

def skin_mesh(name, P, E, material, root, grow=0.0, levels=2):
    """Edge skeleton -> Skin modifier -> subdivision. Radii grow by `grow` (for garment shells)."""
    names = list(P.keys()); idx = {n:i for i,n in enumerate(names)}
    bm = bmesh.new(); vs = [bm.verts.new(P[n][0]) for n in names]
    for a,b in E: bm.edges.new((vs[idx[a]], vs[idx[b]]))
    ob = new_mesh_obj(name, bm, material)
    sk = ob.modifiers.new("skin", 'SKIN'); sk.use_smooth_shade = True
    sv = ob.data.skin_vertices[0].data
    for n in names:
        r = P[n][1] + grow; sv[idx[n]].radius = (r, r)
    sv[idx[root]].use_root = True
    subsurf(ob, levels)
    apply_all(ob)
    return ob

def build_body(seated, M, hz):
    """Organic body from an edge skeleton via the Skin modifier, dressed in separate jersey / shorts shells."""
    S = skeleton(seated, hz)
    E = [("hips","spine"),("spine","chest"),("chest","neck"),("neck","head")]
    for tag in ("R","L"):
        E += [("chest","sh"+tag),("sh"+tag,"el"+tag),("el"+tag,"wr"+tag),("hips","hp"+tag),("hp"+tag,"kn"+tag),("kn"+tag,"an"+tag),("an"+tag,"to"+tag)]
    body = skin_mesh("body", S, E, M["skin"], "hips")
    # jersey: torso from collar to just below the hips, short sleeves to mid upper-arm
    J = {"hem": ((0, 0.005, hz-0.01), S["hips"][1]), "spine": S["spine"], "chest": S["chest"],
         "collar": ((0, 0.02, hz+0.555), 0.075)}
    JE = [("hem","spine"),("spine","chest"),("chest","collar")]
    for tag in ("R","L"):
        J["sh"+tag] = S["sh"+tag]; J["sl"+tag] = (mix(S["sh"+tag][0], S["el"+tag][0], 0.5), 0.062)
        JE += [("chest","sh"+tag),("sh"+tag,"sl"+tag)]
    jersey = skin_mesh("jersey", J, JE, M["jersey"], "spine", grow=0.018)
    # shorts: waistband to just above the knees
    H = {"waist": ((0, 0, hz+0.11), S["hips"][1]-0.004), "hips": S["hips"]}
    HE = [("waist","hips")]
    for tag in ("R","L"):
        H["hp"+tag] = S["hp"+tag]; H["th"+tag] = (mix(S["hp"+tag][0], S["kn"+tag][0], 0.62), 0.078)
        HE += [("hips","hp"+tag),("hp"+tag,"th"+tag)]
    shorts = skin_mesh("shorts", H, HE, M["shorts"], "hips", grow=0.022)
    return [body, jersey, shorts]

def build_driver(seated, colors):
    M = dict(
        jersey = mat("jersey", (0.75, 0.10, 0.10), 0.0, 0.85, sheen=0.7, sheen_rough=0.45),
        helmet = mat("helmet", (0.85, 0.15, 0.15), 0.40, 0.22, coat=1.0, coat_rough=0.05),
        skin   = mat("skin",   (0.85, 0.62, 0.48), 0.0, 0.55),
        pads   = mat("pads",   (0.16, 0.17, 0.19), 0.05, 0.8),
        gloves = mat("gloves", (0.12, 0.12, 0.13), 0.05, 0.7),
        mask   = mat("mask",   (0.80, 0.82, 0.85), 0.9, 0.3),
        shorts = mat("shorts", (0.12, 0.14, 0.18), 0.0, 0.85, sheen=0.5),
        shoe   = mat("shoe",   (0.94, 0.94, 0.92), 0.0, 0.55, coat=0.3),
        white  = mat("stripe", (0.96, 0.96, 0.96), 0.2, 0.5),
        eye    = mat("eye",    (0.06, 0.05, 0.05), 0.2, 0.15, coat=1.0),
        eyewhite = mat("eyeWhite", (0.92, 0.90, 0.88), 0.0, 0.3, coat=0.6),
        guard  = mat("mouthguard", (0.85, 0.85, 0.80), 0.0, 0.35, coat=0.5),
    )
    hz = 0.55 if seated else 0.95
    parts = build_body(seated, M, hz)
    # gear
    parts.append(rbox("padL", (0.19, 0.27, 0.12), (-0.235, 0.01, hz+0.55), M["pads"], bev=0.05, segs=3))
    parts.append(rbox("padR", (0.19, 0.27, 0.12), ( 0.235, 0.01, hz+0.55), M["pads"], bev=0.05, segs=3))
    parts.append(rbox("chestpad", (0.30, 0.06, 0.20), (0, 0.17, hz+0.40), M["pads"], bev=0.03))
    parts.append(rbox("numpatch", (0.14, 0.01, 0.17), (0, 0.205, hz+0.40), M["white"], bev=0.004))
    # face under the mask: eyes, brow, mouthguard
    for s in (1,-1):
        parts.append(cylinder("eyewhite%d"%(s+1), 0.021, 0.012, (s*0.036, 0.13, hz+0.755), M["eyewhite"], axis='Y', segs=14))
        parts.append(cylinder("pupil%d"%(s+1), 0.010, 0.014, (s*0.036, 0.135, hz+0.755), M["eye"], axis='Y', segs=12))
    parts.append(rbox("brow", (0.10, 0.02, 0.012), (0, 0.128, hz+0.782), M["skin"], bev=0.004))
    parts.append(rbox("nose", (0.026, 0.03, 0.04), (0, 0.142, hz+0.725), M["skin"], bev=0.01, segs=3))
    parts.append(rbox("mouthguard", (0.07, 0.025, 0.02), (0, 0.135, hz+0.685), M["guard"], bev=0.008))
    # helmet: shell + brim + stripe + facemask cage
    hel = rbox("helmetshell", (0.27, 0.30, 0.27), (0, 0.0, hz+0.775), M["helmet"], bev=0.11, segs=5)
    subsurf(hel, 2); parts.append(hel)
    parts.append(rbox("visor", (0.23, 0.11, 0.02), (0, 0.16, hz+0.82), M["helmet"], bev=0.008))
    parts.append(rbox("stripe", (0.03, 0.27, 0.012), (0, -0.01, hz+0.915), M["white"], bev=0.003))
    parts.append(rbox("earhole", (0.02, 0.05, 0.05), (0.14, 0.0, hz+0.74), M["pads"], bev=0.01))
    parts.append(rbox("earhole2", (0.02, 0.05, 0.05), (-0.14, 0.0, hz+0.74), M["pads"], bev=0.01))
    for k in range(4):
        z = hz + 0.795 - k*0.035
        parts.append(tube_from_points("maskbar%d"%k, [(-0.12, 0.05, z), (0, 0.185, z-0.012), (0.12, 0.05, z)], 0.0065, M["mask"]))
    for xx in (-0.045, 0.045):
        parts.append(tube_from_points("maskv%d"%int(xx*100), [(xx, 0.17, hz+0.83), (xx, 0.18, hz+0.66)], 0.0065, M["mask"], smooth_path=False))
    parts.append(tube_from_points("chinstrap", [(-0.12, 0.05, hz+0.66), (0, 0.10, hz+0.62), (0.12, 0.05, hz+0.66)], 0.006, M["pads"]))
    # gloves + cleats (positions match the skeleton wrists / toes)
    if seated: wr = lambda s: (s*0.16, 0.37, hz+0.45); to = lambda s: (s*0.14, 0.64, hz-0.35)
    else:      wr = lambda s: (s*0.25, 0.15, hz+0.04); to = lambda s: (s*0.12, 0.17, hz-0.93)
    for s in (1,-1):
        g = rbox("glove%d"%(s+1), (0.10, 0.15, 0.08), wr(s), M["gloves"], bev=0.035, segs=3); subsurf(g, 1); parts.append(g)
        parts.append(rbox("cuff%d"%(s+1), (0.11, 0.05, 0.10), (wr(s)[0], wr(s)[1]-0.08, wr(s)[2]), M["pads"], bev=0.02))
        t = to(s); parts.append(rbox("cleat%d"%(s+1), (0.11, 0.29, 0.085), (t[0], t[1]-0.06, t[2]+0.02), M["shoe"], bev=0.03, segs=3))
        parts.append(rbox("sole%d"%(s+1), (0.115, 0.30, 0.02), (t[0], t[1]-0.06, t[2]-0.02), M["pads"], bev=0.006))
        parts.append(rbox("sock%d"%(s+1), (0.09, 0.09, 0.10), (t[0], t[1]-0.15, t[2]+0.09), M["white"], bev=0.03))
    for p in parts:
        if p.name not in ("body","jersey","shorts"): apply_all(p)
    return join(parts, "driver")

def build_stick():
    M = dict(shaft=mat("shaft", (0.72, 0.74, 0.78), 0.9, 0.35), pocket=mat("pocket", (0.85, 0.15, 0.15), 0.1, 0.6), net=mat("net", (0.95, 0.95, 0.92), 0.0, 0.8))
    parts = [cylinder("shaft", 0.014, 1.02, (0,0,0.51), M["shaft"], segs=16, bev=0.006)]
    # head outline (teardrop) as a curve tube
    pts = [(0, 0, 1.02), (-0.075, 0, 1.10), (-0.085, 0, 1.22), (-0.06, 0, 1.31), (0, 0, 1.335), (0.06, 0, 1.31), (0.085, 0, 1.22), (0.075, 0, 1.10), (0, 0, 1.02)]
    head = tube_from_points("head", pts, 0.011, M["pocket"]); parts.append(head)
    parts.append(rbox("throat", (0.05, 0.03, 0.06), (0, 0, 1.03), M["pocket"], bev=0.012))
    # net: subdivided plane inside the head + wireframe
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=5, y_segments=8, size=1.0)
    for v in bm.verts:
        u = v.co.x; t = (v.co.y + 1)/2   # 0..1 along the head
        w = 0.075 * math.sin(math.pi * min(1.0, t*1.05))
        v.co = Vector((u*w, -0.02*math.sin(math.pi*t), 1.03 + t*0.29))
    net = new_mesh_obj("net", bm, M["net"])
    wf = net.modifiers.new("wire", 'WIREFRAME'); wf.thickness = 0.0035; wf.use_replace = True
    parts.append(net)
    for p in parts: apply_all(p)
    return join(parts, "stick")

# ------------------------------------------------------------------ export
def export(path, render=False):
    kw = dict(filepath=path, export_format='GLB', export_apply=True, export_texcoords=True,
              export_normals=True, export_materials='EXPORT', export_animations=False,
              export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
              export_yup=True, use_visible=True)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print("retrying export with minimal args:", e)
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True)
    if render:
        render_preview(path.replace(".glb", ".png"))

def render_preview(path, res=640):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_shadows = True; sc.display.shading.show_cavity = True
    sc.render.resolution_x = res; sc.render.resolution_y = int(res*0.66)
    sc.render.filepath = path
    cam_data = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_data); link(cam)
    # frame all
    xs=[];ys=[];zs=[]
    for o in bpy.data.objects:
        if o.type=='MESH':
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c); xs.append(w.x); ys.append(w.y); zs.append(w.z)
    cx,cy,cz = (max(xs)+min(xs))/2,(max(ys)+min(ys))/2,(max(zs)+min(zs))/2
    ext = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
    cam.location = (cx + ext*1.15, cy - ext*1.25, cz + ext*0.75)
    d = Vector((cx,cy,cz)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
    cam_data.lens = 45
    sc.camera = cam
    bpy.ops.render.render(write_still=True)

VEHICLES = {
    # style, L, W, wb, R, hoodH, roofH, cab(y0,y1), extras
    "bronco96":   dict(style="wagon",  L=4.65, W=1.92, wb=2.65, R=0.40, hoodH=1.12, roofH=1.86, cab=(-2.0, 0.55), rake=0.42, spare=True, flares=True, steps=True),
    "wranglerTJ": dict(style="wagon",  L=3.85, W=1.75, wb=2.35, R=0.40, hoodH=1.05, roofH=1.80, cab=(-1.6, 0.35), rake=0.22, spare=True, roundLights=True, jeepGrille=True, blackFlares=True, chromeBumpers=False),
    "runner5g":   dict(style="modern", L=4.85, W=1.95, wb=2.75, R=0.39, hoodH=1.18, roofH=1.82, cab=(-2.1, 0.85), rake=0.72, rack=True, flares=True, bev=0.07),
    "disco2":     dict(style="rover",  L=4.70, W=1.90, wb=2.55, R=0.38, hoodH=1.14, roofH=1.86, cab=(-2.1, 0.62), rake=0.40, rack=True, steps=True),
    "cherokeeXJ": dict(style="wagon",  L=4.25, W=1.78, wb=2.58, R=0.36, hoodH=1.02, roofH=1.66, cab=(-1.9, 0.55), rake=0.38, flares=False, chromeBumpers=False),
    "bronco21":   dict(style="modern", L=4.80, W=1.98, wb=2.95, R=0.42, hoodH=1.20, roofH=1.90, cab=(-2.0, 0.65), rake=0.45, spare=True, roundLights=True, rack=True, blackFlares=True, chromeBumpers=False, bev=0.07),
    "runner3g":   dict(style="modern", L=4.65, W=1.85, wb=2.67, R=0.38, hoodH=1.10, roofH=1.78, cab=(-2.0, 0.7), rake=0.62, rack=True, flares=True),
    "defender90": dict(style="rover",  L=3.95, W=1.80, wb=2.36, R=0.39, hoodH=1.12, roofH=1.98, cab=(-1.7, 0.45), rake=0.16, spare=True, roundLights=True, rack=True, snorkel=True, chromeBumpers=False),
    "willys":     dict(style="open",   L=3.40, W=1.60, wb=2.05, R=0.36, hoodH=0.98, roofH=1.20, cab=(-1.3, 0.35), belt=0.95, spare=True, roundLights=True, jeepGrille=True, flares=False, chromeBumpers=False),
    "bronco66":   dict(style="halfcab",L=3.90, W=1.75, wb=2.34, R=0.38, hoodH=1.05, roofH=1.78, cab=(-0.55, 0.55), rake=0.28, spare=True, roundLights=True, flares=False),
    "rangeclassic":dict(style="rover", L=4.50, W=1.82, wb=2.54, R=0.37, hoodH=1.08, roofH=1.80, cab=(-2.0, 0.6), rake=0.40, rack=True, flares=False),
    "runner85":   dict(style="soft",   L=4.45, W=1.70, wb=2.63, R=0.38, hoodH=1.06, roofH=1.74, cab=(-0.65, 0.55), rake=0.34, spare=True, flares=True, blackFlares=True, chromeBumpers=True),
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="build/models")
    ap.add_argument("--only", default="")
    ap.add_argument("--render", action="store_true")
    args = ap.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
    os.makedirs(args.out, exist_ok=True)
    only = [s for s in args.only.split(",") if s]
    for key, spec in VEHICLES.items():
        if only and key not in only: continue
        reset_scene(); MATS.clear()
        M = std_mats()
        build_vehicle(spec, M)
        export(os.path.join(args.out, key + ".glb"), args.render)
        print("built", key)
    for key, seated in (("driverSeated", True), ("driverStanding", False)):
        if only and key not in only: continue
        reset_scene(); MATS.clear()
        build_driver(seated, None)
        export(os.path.join(args.out, key + ".glb"), args.render)
        print("built", key)
    if not only or "stick" in only:
        reset_scene(); MATS.clear()
        build_stick()
        export(os.path.join(args.out, "stick.glb"), args.render)
        print("built stick")

if __name__ == "__main__":
    main()
