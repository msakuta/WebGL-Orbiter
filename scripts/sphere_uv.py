#! /usr/bin/env python

import numpy as np
import math
import sys

class Vertex:
    v = 0
    t = 0
    n = 0

    def __init__(self, v, t, n):
        self.v = v
        self.t = t
        self.n = n

class SphereUV:
    vertices = []
    faces = []
    uvs = []
    normals = []

    def __init__(self, filename):
        self.vertices = []
        self.faces = []
        self.uvs = []
        self.normals = []

        with open(filename) as f:
            for line in f:
                tokens = line.split()
                if tokens[0] == "v" and 3 < len(tokens):
                    self.vertices.append(tokens[1:])
                elif tokens[0] == "f":
                    self.faces.append([Vertex(*[int(idx)-1 for idx in token.split("/")]) for token in tokens[1:]])
                elif tokens[0] == "vt":
                    self.uvs.append([float(token) for token in tokens[1:]])
                elif tokens[0] == "vn":
                    self.normals.append([float(token) for token in tokens[1:]])
        self.vertices = np.asarray(self.vertices, dtype=float)
        # print(faces)

    @staticmethod
    def gen_uvs(faces, vertices):
        invs = 0
        uvbuf = []
        uvmap = {}
        uvidx = []
        for face in faces:
            uv = []
            for v in face:
                vec = [vertices[v.v,i] for i in range(3)]
                uv.append([
                    (math.atan2(vec[1], vec[0])) % (math.pi * 2) / (math.pi * 2.),
                    math.acos(vec[2] / ((vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]) ** 0.5)) / math.pi
                ])
                # print(f"uv: {uv[-1]}")

            for j in range(1, len(face)):
                if 0.5 < abs(uv[0][0] - uv[j][0]):
                    # if uv[j][0]
                    f = uv[j][0] - uv[0][0]
                    n = f - (math.floor(f - 0.5)) - 1. + uv[0][0]
                    # print(f"uv {uv[j][0]} {uv[0][0]} = {n}")
                    uv[j][0] = n
                    invs += 1

            uvidx0 = []
            for uv0, v in zip(uv, face):
                uv0 = (uv0[0], uv0[1])
                if uv0 in uvmap:
                    v.t = uvmap[uv0]
                    uvidx0.append(uvmap[uv0])
                else:
                    v.t = len(uvbuf)
                    uvidx0.append(len(uvbuf))
                    uvmap[uv0] = len(uvbuf)
                    # print(f"Adding uv {uv0} at {len(uvbuf)}: {uvidx0}")
                    uvbuf.append(uv0)
            uvidx.append(uvidx0)

        print(invs, len(faces))
        return uvidx, uvbuf

    def write(self, output_file):
        uvidx, uvbuf = self.gen_uvs(self.faces, self.vertices)

        # Output to an obj file
        with open(output_file, "w") as f:
            f.write("""mtllib phobos_t.mtl
o phobos
""")
            for vertex in self.vertices:
                f.write(f"v {' '.join([str(v) for v in vertex])}\n")
            for uv in uvbuf:
                # print(uv, len(uvidx))
                # uvv = ([uvbuf[vu] for vu in uv + [uv[0]]])
                f.write(f"vt {' '.join([str(v) for v in uv])}\n")
            print(f"writing {len(self.normals)} normals")
            for n in self.normals:
                f.write(f"vn {' '.join([str(v) for v in n])}\n")
            f.write("""usemtl Default_OBJ
s 1
""")
            for face, uv in zip(self.faces, uvidx):
                f.write(f"f {' '.join([str(v.v + 1) + '/' + str(v.t + 1) + '/' + str(v.n + 1) for v in face])}\n")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"usage: {sys.argv[0]} input output")
        exit()
    sphere_uv = SphereUV(sys.argv[1])
    sphere_uv.write(sys.argv[2])
