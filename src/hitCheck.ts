import * as THREE from 'three/src/Three';

/** The result type of jHitSpherePos */
export interface HitResult {
    retf: number;
    pos: THREE.Vector3;
    dist: number;
}


/** determine intersection of a sphere shell and a ray. it's equivalent to inter-sphere hit detection,
 * when the radius argument is sum of the two spheres. */
export function jHitSpherePos(obj: THREE.Vector3, radius: number, src: THREE.Vector3, dir: THREE.Vector3, dt: number): HitResult | null {
    // let b, c, D, d, t0, t1, dirslen;
    // let ret;

    const del = src.clone().sub(obj);

    /* scalar product of the ray and the vector. */
    const b = dir.dot(del);

    /* ??? */
    const dirslen = dir.lengthSq();
    const c = dirslen * (del.lengthSq() - radius * radius);

    // Return the nearest point to the sphere's center on the line if no hit detected.
    let pos = del.sub(dir.clone().multiplyScalar(b / dirslen));
    // We can always return the distance of the ray and the sphere's center.
    const dist = pos.length();

    /* discriminant?? */
    const D = b * b - c;
    if(D <= 0)
        return null;

    const d = Math.sqrt(D);

    /* we need vector equation's parameter value to determine hitness with line segment */
    if(dirslen === 0.)
        return null;
    const t0 = (-b - d) / dirslen;
    const t1 = (-b + d) / dirslen;

    const ret = 0. <= t1 && /*t0 < dt || 0. <= t1 &&*/ t0 < dt;

    let retf;
    if(t0 < 0 /*&& dt < t1*/){
        pos = new THREE.Vector3();
        retf = 0.;
    }
    else /*if(dt <= t1)*/{
        pos = dir.multiplyScalar(t0);
        retf = t0;
    }
    pos.add(src);

    return ret ? { retf, pos, dist } : null;
}
