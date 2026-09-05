"""Render an equirectangular HDRI sky (Blender's multiple-scattering sky model) with
Cycles on CPU, used by the game for image-based lighting, reflections and the visible sky.
    python3 tools/blender_sky.py --out build/sky.hdr [--w 768]
"""
import bpy, os, sys, argparse, math
ap = argparse.ArgumentParser(); ap.add_argument("--out", default="build/sky.hdr"); ap.add_argument("--w", type=int, default=768)
a = ap.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32; sc.cycles.use_denoising = False
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True; nt = w.node_tree
sky = nt.nodes.new("ShaderNodeTexSky"); sky.sky_type = 'MULTIPLE_SCATTERING'
sky.sun_elevation = math.radians(38); sky.sun_rotation = math.radians(215); sky.altitude = 120
sky.sun_intensity = 0.45; sky.sun_size = math.radians(1.2)
for attr, val in (("air_density", 1.0), ("dust_density", 0.45), ("aerosol_density", 0.45), ("ozone_density", 1.6)):
    if hasattr(sky, attr): setattr(sky, attr, val)
bg = nt.nodes["Background"]; bg.inputs["Strength"].default_value = 0.08
nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
cam = bpy.data.cameras.new("c"); cam.type = 'PANO'
try: cam.panorama_type = 'EQUIRECTANGULAR'
except Exception: cam.cycles.panorama_type = 'EQUIRECTANGULAR'
co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); co.rotation_euler = (math.pi/2, 0, 0); sc.camera = co
sc.render.resolution_x = a.w; sc.render.resolution_y = a.w//2; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'HDR'; sc.render.filepath = os.path.abspath(a.out)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
bpy.ops.render.render(write_still=True)
print("sky rendered:", a.out, os.path.getsize(a.out), "bytes")
