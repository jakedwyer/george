"""
Bake tileable PBR texture sets (albedo / roughness / tangent normal) from procedural
Cycles materials, headless on CPU. Noise-driven materials are baked on a torus whose UVs
span [0,1]^2 and whose 3D coordinates wrap around both loops, so the result tiles
seamlessly; periodic patterns (planks, tiles) use UV coordinates with integer counts.

    python3 tools/blender_textures.py --out build/tex
"""
import bpy, bmesh, math, os, sys, argparse

def torus_uv(major=1.0, minor=0.35, segs=96, rsegs=48):
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    ring = []
    for i in range(segs):
        a = 2*math.pi*i/segs; row = []
        for j in range(rsegs):
            b = 2*math.pi*j/rsegs
            row.append(bm.verts.new(((major+minor*math.cos(b))*math.cos(a), (major+minor*math.cos(b))*math.sin(a), minor*math.sin(b))))
        ring.append(row)
    for i in range(segs):
        for j in range(rsegs):
            f = bm.faces.new((ring[i][j], ring[(i+1)%segs][j], ring[(i+1)%segs][(j+1)%rsegs], ring[i][(j+1)%rsegs]))
            us = [(i/segs, j/rsegs), ((i+1)/segs, j/rsegs), ((i+1)/segs, (j+1)/rsegs), (i/segs, (j+1)/rsegs)]
            for l, (u, v) in zip(f.loops, us): l[uv].uv = (u, v)
    me = bpy.data.meshes.new("torus"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("torus", me); bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob

class NT:
    """tiny node-tree helper"""
    def __init__(self, mat):
        self.nt = mat.node_tree; self.n = self.nt.nodes; self.l = self.nt.links
        self.bsdf = self.n["Principled BSDF"]
        self.uv = self.n.new("ShaderNodeTexCoord")
        m = self.n.new("ShaderNodeMapping"); m.inputs["Location"].default_value = (3.7, 5.1, 2.3)
        m.inputs["Rotation"].default_value = (0.4, 0.7, 0.3)
        self.l.new(self.uv.outputs["Object"], m.inputs["Vector"]); self.obj = m.outputs["Vector"]
    def objlink(self, node): self.l.new(self.obj, node.inputs["Vector"])
    def new(self, t, **kw):
        node = self.n.new(t)
        for k, v in kw.items():
            if k in node.inputs: node.inputs[k].default_value = v
            else: setattr(node, k, v)
        return node
    def link(self, a, ao, b, bi): self.l.new(a.outputs[ao], b.inputs[bi])
    def ramp(self, stops):
        r = self.n.new("ShaderNodeValToRGB"); cr = r.color_ramp
        while len(cr.elements) < len(stops): cr.elements.new(0.5)
        for e, (pos, col) in zip(cr.elements, stops): e.position = pos; e.color = (*col, 1)
        return r
    def bump(self, height_out, strength=0.4, distance=0.02):
        b = self.n.new("ShaderNodeBump"); b.inputs["Strength"].default_value = strength; b.inputs["Distance"].default_value = distance
        self.l.new(height_out, b.inputs["Height"]); self.l.new(b.outputs["Normal"], self.bsdf.inputs["Normal"]); return b

def recipe(name, t):
    """Populate node tree `t` for material `name`. Returns nothing; wires Base Color/Roughness/Normal."""
    uv, obj = t.uv.outputs["UV"], t.uv.outputs["Object"]
    if name == "wood":
        planks = t.new("ShaderNodeTexBrick", Scale=4.0, **{"Mortar Size": 0.02, "Bias": 0.0})
        planks.offset = 0.5; planks.squash = 7.0; planks.squash_frequency = 1
        planks.inputs["Color1"].default_value = (0.62, 0.40, 0.20, 1); planks.inputs["Color2"].default_value = (0.50, 0.31, 0.15, 1)
        planks.inputs["Mortar"].default_value = (0.12, 0.07, 0.03, 1)
        t.link(t.uv, "UV", planks, "Vector")
        stretch = t.n.new("ShaderNodeMapping"); stretch.inputs["Scale"].default_value = (1.0, 0.10, 1.0)
        t.l.new(t.obj, stretch.inputs["Vector"])
        grain = t.new("ShaderNodeTexNoise", Scale=9.0, Detail=7.0, Roughness=0.62, Distortion=0.6)
        t.l.new(stretch.outputs["Vector"], grain.inputs["Vector"])
        gr = t.ramp([(0.35, (0.70, 0.55, 0.40)), (0.55, (1.0, 1.0, 1.0)), (0.75, (0.72, 0.58, 0.42))]); t.link(grain, "Fac", gr, "Fac")
        mul = t.new("ShaderNodeMix"); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs["Factor"].default_value = 1.0
        t.link(planks, "Color", mul, "A"); t.link(gr, "Color", mul, "B"); t.link(mul, "Result", t.bsdf, "Base Color")
        h = t.new("ShaderNodeMath"); h.operation = 'MULTIPLY_ADD'; t.link(planks, "Fac", h, 0); h.inputs[1].default_value = -1.0
        t.link(grain, "Fac", h, 2)
        t.bump(h.outputs["Value"], 0.9, 0.03)
        rr = t.ramp([(0, (0.62,)*3), (1, (0.38,)*3)]); t.link(grain, "Fac", rr, "Fac"); t.link(rr, "Color", t.bsdf, "Roughness")
    elif name in ("tile", "bathTile"):
        n = 2 if name == "tile" else 4
        br = t.new("ShaderNodeTexBrick", Scale=n, **{"Mortar Size": 0.03, "Bias": 0.0}); br.offset = 0.0; br.squash = 1.0
        t.link(t.uv, "UV", br, "Vector")
        chk = t.new("ShaderNodeTexChecker", Scale=n); t.link(t.uv, "UV", chk, "Vector")
        c1, c2 = ((0.86, 0.80, 0.70), (0.72, 0.66, 0.55)) if name == "tile" else ((0.80, 0.88, 0.90), (0.66, 0.78, 0.82))
        chk.inputs["Color1"].default_value = (*c1, 1); chk.inputs["Color2"].default_value = (*c2, 1)
        spec = t.new("ShaderNodeTexNoise", Scale=30.0, Detail=4.0); t.objlink(spec)
        mix = t.new("ShaderNodeMix"); mix.data_type = 'RGBA'; mix.inputs["Factor"].default_value = 0.12
        t.link(chk, "Color", mix, "A"); t.link(spec, "Color", mix, "B")
        gm = t.new("ShaderNodeMix"); gm.data_type = 'RGBA'; gm.inputs["B"].default_value = (0.35, 0.33, 0.30, 1)
        t.link(br, "Fac", gm, "Factor"); t.link(mix, "Result", gm, "A"); t.link(gm, "Result", t.bsdf, "Base Color")
        inv = t.new("ShaderNodeMath"); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; t.link(br, "Fac", inv, 1)
        t.bump(inv.outputs["Value"], 1.0, 0.03)
        rr = t.new("ShaderNodeMath"); rr.operation = 'MULTIPLY_ADD'; t.link(br, "Fac", rr, 0); rr.inputs[1].default_value = 0.6; rr.inputs[2].default_value = 0.25
        t.link(rr, "Value", t.bsdf, "Roughness")
    elif name in ("concrete", "drywall"):
        n1 = t.new("ShaderNodeTexNoise", Scale=12.0, Detail=8.0, Roughness=0.7); t.objlink(n1)
        v = t.new("ShaderNodeTexVoronoi", Scale=40.0); t.objlink(v)
        base = (0.60, 0.62, 0.63) if name == "concrete" else (0.91, 0.89, 0.84)
        ramp = t.ramp([(0.3, tuple(c*0.85 for c in base)), (0.7, base)]); t.link(n1, "Fac", ramp, "Fac"); t.link(ramp, "Color", t.bsdf, "Base Color")
        hm = t.new("ShaderNodeMath"); hm.operation = 'MULTIPLY_ADD'; t.link(v, "Distance", hm, 0); hm.inputs[1].default_value = 0.4 if name == "concrete" else 0.15
        t.link(n1, "Fac", hm, 2); t.bump(hm.outputs["Value"], 0.8, 0.02)
        t.bsdf.inputs["Roughness"].default_value = 0.9
    elif name == "carpet":
        n1 = t.new("ShaderNodeTexNoise", Scale=80.0, Detail=6.0); t.objlink(n1)
        ramp = t.ramp([(0.35, (0.58, 0.52, 0.68)), (0.65, (0.72, 0.66, 0.82))]); t.link(n1, "Fac", ramp, "Fac"); t.link(ramp, "Color", t.bsdf, "Base Color")
        t.bump(n1.outputs["Fac"], 1.0, 0.012); t.bsdf.inputs["Roughness"].default_value = 1.0
    elif name == "grass":
        v = t.new("ShaderNodeTexVoronoi", Scale=60.0); t.objlink(v)
        n1 = t.new("ShaderNodeTexNoise", Scale=6.0, Detail=5.0); t.objlink(n1)
        ramp = t.ramp([(0.2, (0.16, 0.36, 0.12)), (0.55, (0.30, 0.55, 0.18)), (0.9, (0.48, 0.66, 0.24))])
        mx = t.new("ShaderNodeMath"); mx.operation = 'MULTIPLY_ADD'; t.link(v, "Distance", mx, 0); mx.inputs[1].default_value = 0.6; t.link(n1, "Fac", mx, 2)
        t.link(mx, "Value", ramp, "Fac"); t.link(ramp, "Color", t.bsdf, "Base Color")
        t.bump(mx.outputs["Value"], 1.0, 0.03); t.bsdf.inputs["Roughness"].default_value = 0.95
    elif name in ("stone", "fence"):
        br = t.new("ShaderNodeTexBrick", Scale=2 if name == "stone" else 6, **{"Mortar Size": 0.02}); br.offset = 0.5 if name == "stone" else 0.0; br.squash = 1.0 if name == "stone" else 0.08
        t.link(t.uv, "UV", br, "Vector")
        n1 = t.new("ShaderNodeTexNoise", Scale=10.0 if name == "stone" else 20.0, Detail=6.0); t.objlink(n1)
        cols = [(0.3, (0.62, 0.58, 0.50)), (0.7, (0.74, 0.70, 0.62))] if name == "stone" else [(0.3, (0.40, 0.28, 0.15)), (0.7, (0.58, 0.42, 0.24))]
        ramp = t.ramp(cols); t.link(n1, "Fac", ramp, "Fac")
        gm = t.new("ShaderNodeMix"); gm.data_type = 'RGBA'; gm.inputs["B"].default_value = (0.28, 0.25, 0.22, 1)
        t.link(br, "Fac", gm, "Factor"); t.link(ramp, "Color", gm, "A"); t.link(gm, "Result", t.bsdf, "Base Color")
        inv = t.new("ShaderNodeMath"); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; t.link(br, "Fac", inv, 1)
        hm = t.new("ShaderNodeMath"); hm.operation = 'MULTIPLY_ADD'; t.link(inv, "Value", hm, 0); hm.inputs[1].default_value = 0.8; t.link(n1, "Fac", hm, 2)
        t.bump(hm.outputs["Value"], 1.0, 0.05); t.bsdf.inputs["Roughness"].default_value = 0.85
    elif name == "rubber":
        n1 = t.new("ShaderNodeTexNoise", Scale=120.0, Detail=4.0); t.objlink(n1)
        t.bsdf.inputs["Base Color"].default_value = (0.9, 0.9, 0.9, 1)   # tinted at runtime
        t.bump(n1.outputs["Fac"], 0.8, 0.01); t.bsdf.inputs["Roughness"].default_value = 0.92
    elif name == "leather":
        v = t.new("ShaderNodeTexVoronoi", Scale=90.0); t.objlink(v)
        n1 = t.new("ShaderNodeTexNoise", Scale=20.0, Detail=3.0); t.objlink(n1)
        ramp = t.ramp([(0.3, (0.80, 0.80, 0.80)), (0.8, (1.0, 1.0, 1.0))]); t.link(n1, "Fac", ramp, "Fac"); t.link(ramp, "Color", t.bsdf, "Base Color")
        t.bump(v.outputs["Distance"], 1.0, 0.02); rr = t.ramp([(0, (0.45,)*3), (1, (0.7,)*3)]); t.link(n1, "Fac", rr, "Fac"); t.link(rr, "Color", t.bsdf, "Roughness")
    elif name in ("canvas", "fabric"):
        sc = 40.0 if name == "canvas" else 90.0
        w1 = t.new("ShaderNodeTexWave", Scale=sc, Distortion=0.3); w1.wave_type = 'BANDS'; w1.bands_direction = 'X'; t.link(t.uv, "UV", w1, "Vector")
        w2 = t.new("ShaderNodeTexWave", Scale=sc, Distortion=0.3); w2.wave_type = 'BANDS'; w2.bands_direction = 'Y'; t.link(t.uv, "UV", w2, "Vector")
        mx = t.new("ShaderNodeMath"); mx.operation = 'MULTIPLY'; t.link(w1, "Fac", mx, 0); t.link(w2, "Fac", mx, 1)
        n1 = t.new("ShaderNodeTexNoise", Scale=15.0, Detail=4.0); t.objlink(n1)
        ramp = t.ramp([(0.3, (0.82,)*3), (0.8, (1.0,)*3)]); t.link(n1, "Fac", ramp, "Fac"); t.link(ramp, "Color", t.bsdf, "Base Color")
        t.bump(mx.outputs["Value"], 1.0, 0.012); t.bsdf.inputs["Roughness"].default_value = 0.95
    elif name == "paintFlake":
        n1 = t.new("ShaderNodeTexNoise", Scale=400.0, Detail=2.0); t.objlink(n1)
        t.bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
        t.bump(n1.outputs["Fac"], 0.5, 0.003); t.bsdf.inputs["Roughness"].default_value = 0.3
    elif name == "alloy":
        w1 = t.new("ShaderNodeTexWave", Scale=200.0, Distortion=1.5, Detail=2.0); w1.wave_type = 'BANDS'; w1.bands_direction = 'X'; t.link(t.uv, "UV", w1, "Vector")
        t.bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
        t.bump(w1.outputs["Fac"], 0.5, 0.003)
        rr = t.ramp([(0, (0.22,)*3), (1, (0.4,)*3)]); t.link(w1, "Fac", rr, "Fac"); t.link(rr, "Color", t.bsdf, "Roughness")
    elif name == "skin":
        n1 = t.new("ShaderNodeTexNoise", Scale=180.0, Detail=3.0); t.objlink(n1)
        n2 = t.new("ShaderNodeTexNoise", Scale=12.0, Detail=3.0); t.objlink(n2)
        ramp = t.ramp([(0.35, (0.90, 0.86, 0.84)), (0.7, (1.0, 1.0, 1.0))]); t.link(n2, "Fac", ramp, "Fac"); t.link(ramp, "Color", t.bsdf, "Base Color")
        t.bump(n1.outputs["Fac"], 0.6, 0.006); t.bsdf.inputs["Roughness"].default_value = 0.55

RES = {"wood":512,"tile":512,"bathTile":512,"concrete":512,"carpet":512,"grass":512,"stone":512,"fence":512,"drywall":256,
       "rubber":256,"leather":256,"canvas":256,"fabric":256,"paintFlake":256,"alloy":256,"skin":256}

def bake(name, out, res):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16
    sc.cycles.use_denoising = False
    ob = torus_uv()
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    t = NT(mat); recipe(name, t)
    ob.data.materials.append(mat)
    imgs = {}
    for kind, btype, cs in (("albedo", 'DIFFUSE', 'sRGB'), ("rough", 'ROUGHNESS', 'Non-Color'), ("normal", 'NORMAL', 'Non-Color')):
        img = bpy.data.images.new(name + "_" + kind, res, res, float_buffer=False)
        img.colorspace_settings.name = cs
        ti = t.n.new("ShaderNodeTexImage"); ti.image = img; t.n.active = ti
        sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True
        sc.render.bake.normal_space = 'TANGENT'
        with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
            bpy.ops.object.bake(type=btype, margin=4)
        sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 92 if kind == "normal" else 85
        path = os.path.join(out, f"{name}_{kind}.jpg")
        img.save_render(path)
        imgs[kind] = path
    return imgs

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--out", default="build/tex"); ap.add_argument("--only", default="")
    a = ap.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
    os.makedirs(a.out, exist_ok=True)
    for n, r in RES.items():
        if a.only and n not in a.only.split(","): continue
        bake(n, a.out, r); print("baked", n, r)
