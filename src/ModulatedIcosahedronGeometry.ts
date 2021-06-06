import * as THREE from 'three/src/Three';

/// Copied from three.js IcosahedronGeometry
export class ModulatedIcosahedronGeometry extends THREE.BufferGeometry {
    constructor(radius = 1, detail = 3, modulator: ((a: THREE.Vector3) => void)){
        super();
        const t = ( 1 + Math.sqrt( 5 ) ) / 2;

        const vertices = [
            - 1, t, 0, 	1, t, 0, 	- 1, - t, 0, 	1, - t, 0,
            0, - 1, t, 	0, 1, t,	0, - 1, - t, 	0, 1, - t,
            t, 0, - 1, 	t, 0, 1, 	- t, 0, - 1, 	- t, 0, 1
        ];

        const indices = [
            0, 11, 5, 	0, 5, 1, 	0, 1, 7, 	0, 7, 10, 	0, 10, 11,
            1, 5, 9, 	5, 11, 4,	11, 10, 2,	10, 7, 6,	7, 1, 8,
            3, 9, 4, 	3, 4, 2,	3, 2, 6,	3, 6, 8,	3, 8, 9,
            4, 9, 5, 	2, 4, 11,	6, 2, 10,	8, 6, 7,	9, 8, 1
        ];

        // super( vertices, indices, radius, detail );

        // this.type = 'IcosahedronGeometry';

        // this.parameters = {
        //     radius: radius,
        //     detail: detail
        // };

        const vertexBuffer: number[] = [];
        const indexBuffer: number[] = [];

        // the subdivision creates the vertex buffer data

        subdivide( detail );

        // all vertices should lie on a conceptual sphere with a given radius

        applyRadius( radius );

        // build non-indexed geometry

        this.setAttribute( 'position', new THREE.Float32BufferAttribute( vertexBuffer, 3 ) );
        this.setIndex( indexBuffer );
        this.setAttribute( 'normal', new THREE.Float32BufferAttribute( vertexBuffer.slice(), 3 ) );
        // this.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvBuffer, 2 ) );

        if ( detail === 0 ) {

            this.computeVertexNormals(); // flat normals

        } else {

            this.normalizeNormals(); // smooth normals

        }

        function pushVertex( vertex: THREE.Vector3 ) {

            for(let i = 0; i < vertexBuffer.length / 3; i++){
                if(vertexBuffer[i * 3] === vertex.x &&
                    vertexBuffer[i * 3 + 1] === vertex.y &&
                    vertexBuffer[i * 3 + 2] === vertex.z){
                        indexBuffer.push(i);
                        return;
                    }
            }
            vertexBuffer.push( vertex.x, vertex.y, vertex.z );
            indexBuffer.push( vertexBuffer.length-1 );
        }

        function getVertexByIndex( index: number, vertex: THREE.Vector3 ) {

            const stride = index * 3;

            vertex.x = vertices[ stride + 0 ];
            vertex.y = vertices[ stride + 1 ];
            vertex.z = vertices[ stride + 2 ];

        }

        function subdivide( detail: number ) {

            const a = new THREE.Vector3();
            const b = new THREE.Vector3();
            const c = new THREE.Vector3();

            // iterate over all faces and apply a subdivison with the given detail value

            for ( let i = 0; i < indices.length; i += 3 ) {

                // get the vertices of the face

                getVertexByIndex( indices[ i + 0 ], a );
                getVertexByIndex( indices[ i + 1 ], b );
                getVertexByIndex( indices[ i + 2 ], c );

                // perform subdivision

                subdivideFace( a, b, c, detail );

            }

        }

        function subdivideFace( a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, detail: number ) {

            const cols = detail + 1;

            // we use this multidimensional array as a data structure for creating the subdivision

            const v = [];

            // construct all of the vertices for this subdivision

            for ( let i = 0; i <= cols; i ++ ) {

                v[ i ] = [];

                const aj = a.clone().lerp( c, i / cols );
                const bj = b.clone().lerp( c, i / cols );

                const rows = cols - i;

                for ( let j = 0; j <= rows; j ++ ) {

                    if ( j === 0 && i === cols ) {

                        v[ i ][ j ] = aj;

                    } else {

                        v[ i ][ j ] = aj.clone().lerp( bj, j / rows );

                    }

                }

            }

            // construct all of the faces

            for ( let i = 0; i < cols; i ++ ) {

                for ( let j = 0; j < 2 * ( cols - i ) - 1; j ++ ) {

                    const k = Math.floor( j / 2 );

                    if ( j % 2 === 0 ) {

                        pushVertex( v[ i ][ k + 1 ] );
                        pushVertex( v[ i + 1 ][ k ] );
                        pushVertex( v[ i ][ k ] );

                    } else {

                        pushVertex( v[ i ][ k + 1 ] );
                        pushVertex( v[ i + 1 ][ k + 1 ] );
                        pushVertex( v[ i + 1 ][ k ] );

                    }

                }

            }

        }

        function applyRadius( radius: number ) {

            const vertex = new THREE.Vector3();

            // iterate over the entire buffer and apply the radius to each vertex

            for ( let i = 0; i < vertexBuffer.length; i += 3 ) {

                vertex.x = vertexBuffer[ i + 0 ];
                vertex.y = vertexBuffer[ i + 1 ];
                vertex.z = vertexBuffer[ i + 2 ];

                vertex.normalize().multiplyScalar( radius );

                modulator(vertex);

                vertexBuffer[ i + 0 ] = vertex.x;
                vertexBuffer[ i + 1 ] = vertex.y;
                vertexBuffer[ i + 2 ] = vertex.z;

            }

        }

    }
}
