import {
    Color,
    DefaultLoadingManager,
    FileLoader,
    FrontSide,
    Loader,
    LoaderUtils,
    Material,
    MeshPhongMaterial,
    MeshPhongMaterialParameters,
    RepeatWrapping,
    TextureLoader,
    Vector2,
    LoadingManager,
    Side,
    Wrapping,
} from 'three/src/Three';


export interface MaterialCreatorOptions {
    /**
   * side: Which side to apply the material
   * THREE.FrontSide (default), THREE.BackSide, THREE.DoubleSide
   */
    side?: Side;
    /*
   * wrap: What type of wrapping to apply for textures
   * THREE.RepeatWrapping (default), THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping
   */
    wrap?: Wrapping;
    /*
   * normalizeRGB: RGBs need to be normalized to 0-1 from 0-255
   * Default: false, assumed to be already normalized
   */
    normalizeRGB?: boolean;
    /*
   * ignoreZeroRGBs: Ignore values of RGBs (Ka,Kd,Ks) that are all 0's
   * Default: false
   */
    ignoreZeroRGBs?: boolean;
    /*
   * invertTrProperty: Use values 1 of Tr field for fully opaque. This option is useful for obj
   * exported from 3ds MAX, vcglib or meshlab.
   * Default: false
   */
    invertTrProperty?: boolean;
}

/**
 * Loads a Wavefront .mtl file specifying materials
 */

class MTLLoader extends Loader {
    protected materialOptions: MaterialCreatorOptions;

    constructor( manager?: LoadingManager ) {
        super( manager );
    }

    /**
     * Loads and parses a MTL asset from a URL.
     *
     * @param {String} url - URL to the MTL file.
     * @param {Function} [onLoad] - Callback invoked with the loaded object.
     * @param {Function} [onProgress] - Callback for download progress.
     * @param {Function} [onError] - Callback for download errors.
     *
     * @see setPath setResourcePath
     *
     * @note In order for relative texture references to resolve correctly
     * you must call setResourcePath() explicitly prior to load.
     */
    load( url: string,
        onLoad: (materialCreator: MaterialCreator) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: ErrorEvent) => void )
    {
        const scope = this;

        const path = ( this.path === '' ) ? LoaderUtils.extractUrlBase( url ) : this.path;

        const loader = new FileLoader( this.manager );
        loader.setPath( this.path );
        loader.setRequestHeader( this.requestHeader );
        loader.setWithCredentials( this.withCredentials );
        loader.load( url, function ( text ) {

            try {

                if( text instanceof ArrayBuffer ){
                    onError( new ErrorEvent("WrongType") );
                    return;
                }

                onLoad( scope.parse( text, path ) );

            } catch ( e ) {

                if ( onError ) {

                    onError( e );

                } else {

                    console.error( e );

                }

                scope.manager.itemError( url );

            }

        }, onProgress, onError );

    }

    setMaterialOptions( value: MaterialCreatorOptions ) {

        this.materialOptions = value;
        return this;

    }

    /**
     * Parses a MTL file.
     *
     * @param {String} text - Content of MTL file
     * @return {MTLLoader.MaterialCreator}
     *
     * @see setPath setResourcePath
     *
     * @note In order for relative texture references to resolve correctly
     * you must call setResourcePath() explicitly prior to parse.
     */
    parse( text: string, path: string ) {

        const lines = text.split( '\n' );
        let info: any = {};
        const delimiter_pattern = /\s+/;
        const materialsInfo: any = {};

        for ( let i = 0; i < lines.length; i ++ ) {

            let line = lines[ i ];
            line = line.trim();

            if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

                // Blank line or comment ignore
                continue;

            }

            var pos = line.indexOf( ' ' );

            var key = ( pos >= 0 ) ? line.substring( 0, pos ) : line;
            key = key.toLowerCase();

            var value = ( pos >= 0 ) ? line.substring( pos + 1 ) : '';
            value = value.trim();

            if ( key === 'newmtl' ) {

                // New material

                info = { name: value };
                materialsInfo[ value ] = info;

            } else {

                if ( key === 'ka' || key === 'kd' || key === 'ks' || key === 'ke' ) {

                    var ss = value.split( delimiter_pattern, 3 );
                    info[ key ] = [ parseFloat( ss[ 0 ] ), parseFloat( ss[ 1 ] ), parseFloat( ss[ 2 ] ) ];

                } else {

                    info[ key ] = value;

                }

            }

        }

        const materialCreator = new MaterialCreator( this.resourcePath || path, this.materialOptions );
        materialCreator.setCrossOrigin( this.crossOrigin );
        materialCreator.setManager( this.manager );
        materialCreator.setMaterials( materialsInfo );
        return materialCreator;

    }
}

class MaterialCreator {
    protected baseUrl: string = '';
    protected options: MaterialCreatorOptions;
    protected materialsInfo: any = {};
    protected materials: any = {};
    protected materialsArray: any[] = [];
    protected nameLookup: any = {};

    protected side: Side;
    protected wrap: Wrapping;

    /**
     * Create a new MTLLoader.MaterialCreator
     * @param baseUrl - Url relative to which textures are loaded
     * @param options - Set of options on how to construct the materials
     *                  side: Which side to apply the material
     *                        FrontSide (default), THREE.BackSide, THREE.DoubleSide
     *                  wrap: What type of wrapping to apply for textures
     *                        RepeatWrapping (default), THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping
     *                  normalizeRGB: RGBs need to be normalized to 0-1 from 0-255
     *                                Default: false, assumed to be already normalized
     *                  ignoreZeroRGBs: Ignore values of RGBs (Ka,Kd,Ks) that are all 0's
     *                                  Default: false
     * @constructor
     */

    constructor( baseUrl: string, options: MaterialCreatorOptions ) {

        this.baseUrl = baseUrl || '';
        this.options = options;
        this.materialsInfo = {};
        this.materials = {};
        this.materialsArray = [];
        this.nameLookup = {};

        this.side = ( this.options && this.options.side ) ? this.options.side : FrontSide;
        this.wrap = ( this.options && this.options.wrap ) ? this.options.wrap : RepeatWrapping;

    };

    protected crossOrigin: string = 'anonymous';

    setCrossOrigin( value: string ) {
        this.crossOrigin = value;
        return this;
    }

    protected manager: LoadingManager;

    setManager( value: LoadingManager ) {
        this.manager = value;
    }

    setMaterials( materialsInfo: any ) {
        this.materialsInfo = this.convert( materialsInfo );
        this.materials = {};
        this.materialsArray = [];
        this.nameLookup = {};
    }

    convert( materialsInfo: any ) {

        if ( ! this.options ) return materialsInfo;

        let converted: any = {};

        for ( let mn in materialsInfo ) {

            // Convert materials info into normalized form based on options

            let mat = materialsInfo[ mn ];

            let covmat: any = {};

            converted[ mn ] = covmat;

            for ( let prop in mat ) {

                let save = true;
                let value = mat[ prop ];
                let lprop = prop.toLowerCase();

                switch ( lprop ) {

                    case 'kd':
                    case 'ka':
                    case 'ks':

                        // Diffuse color (color under white light) using RGB values

                        if ( this.options && this.options.normalizeRGB ) {

                            value = [ value[ 0 ] / 255, value[ 1 ] / 255, value[ 2 ] / 255 ];

                        }

                        if ( this.options && this.options.ignoreZeroRGBs ) {

                            if ( value[ 0 ] === 0 && value[ 1 ] === 0 && value[ 2 ] === 0 ) {

                                // ignore

                                save = false;

                            }

                        }

                        break;

                    default:

                        break;

                }

                if ( save ) {

                    covmat[ lprop ] = value;

                }

            }

        }

        return converted;

    }

    preload() {

        for ( let mn in this.materialsInfo ) {

            this.create( mn );

        }

    }

    getIndex( materialName: string ) {

        return this.nameLookup[ materialName ];

    }

    getAsArray() {

        let index = 0;

        for ( let mn in this.materialsInfo ) {

            this.materialsArray[ index ] = this.create( mn );
            this.nameLookup[ mn ] = index;
            index ++;

        }

        return this.materialsArray;

    }

    create( materialName: string ): Material {

        if ( this.materials[ materialName ] === undefined ) {

            this.createMaterial_( materialName );

        }

        return this.materials[ materialName ];

    }

    createMaterial_( materialName: string ) {

        type keys = "map" | "bumpMap" | "specularMap" | "emissiveMap" | "normalMap" | "bumpMap" | "alphaMap";

        // Create material

        let scope = this;
        let mat = this.materialsInfo[ materialName ];
        let params: MeshPhongMaterialParameters = {

            name: materialName,
            side: this.side

        };

        function resolveURL( baseUrl: string, url: string ) {

            if ( typeof url !== 'string' || url === '' )
                return '';

            // Absolute URL
            if ( /^https?:\/\//i.test( url ) ) return url;

            return baseUrl + url;

        }

        function setMapForType( mapType: keys, value: string ) {

            if ( params[ mapType ] ) return; // Keep the first encountered texture

            var texParams = scope.getTextureParams( value, params );
            var map = scope.loadTexture( resolveURL( scope.baseUrl, texParams.url ) );

            map.repeat.copy( texParams.scale );
            map.offset.copy( texParams.offset );

            map.wrapS = scope.wrap;
            map.wrapT = scope.wrap;

            params[ mapType ] = map;

        }

        for ( var prop in mat ) {

            var value = mat[ prop ];
            var n;

            if ( value === '' ) continue;

            switch ( prop.toLowerCase() ) {

                // Ns is material specular exponent

                case 'kd':

                    // Diffuse color (color under white light) using RGB values

                    params.color = new Color().fromArray( value );

                    break;

                case 'ks':

                    // Specular color (color when light is reflected from shiny surface) using RGB values
                    params.specular = new Color().fromArray( value );

                    break;

                case 'ke':

                    // Emissive using RGB values
                    params.emissive = new Color().fromArray( value );

                    break;

                case 'map_kd':

                    // Diffuse texture map

                    setMapForType( 'map', value );

                    break;

                case 'map_ks':

                    // Specular map

                    setMapForType( 'specularMap', value );

                    break;

                case 'map_ke':

                    // Emissive map

                    setMapForType( 'emissiveMap', value );

                    break;

                case 'norm':

                    setMapForType( 'normalMap', value );

                    break;

                case 'map_bump':
                case 'bump':

                    // Bump texture map

                    setMapForType( 'bumpMap', value );

                    break;

                case 'map_d':

                    // Alpha map

                    setMapForType( 'alphaMap', value );
                    params.transparent = true;

                    break;

                case 'ns':

                    // The specular exponent (defines the focus of the specular highlight)
                    // A high exponent results in a tight, concentrated highlight. Ns values normally range from 0 to 1000.

                    params.shininess = parseFloat( value );

                    break;

                case 'd':
                    n = parseFloat( value );

                    if ( n < 1 ) {

                        params.opacity = n;
                        params.transparent = true;

                    }

                    break;

                case 'tr':
                    n = parseFloat( value );

                    if ( this.options && this.options.invertTrProperty ) n = 1 - n;

                    if ( n > 0 ) {

                        params.opacity = 1 - n;
                        params.transparent = true;

                    }

                    break;

                default:
                    break;

            }

        }

        this.materials[ materialName ] = new MeshPhongMaterial( params );
        return this.materials[ materialName ];

    }

    getTextureParams( value: string, matParams: any ) {

        var texParams: {
            scale: Vector2;
            offset: Vector2;
            url?: string;
        } = {

            scale: new Vector2( 1, 1 ),
            offset: new Vector2( 0, 0 )

         };

        var items = value.split( /\s+/ );
        var pos;

        pos = items.indexOf( '-bm' );

        if ( pos >= 0 ) {

            matParams.bumpScale = parseFloat( items[ pos + 1 ] );
            items.splice( pos, 2 );

        }

        pos = items.indexOf( '-s' );

        if ( pos >= 0 ) {

            texParams.scale.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
            items.splice( pos, 4 ); // we expect 3 parameters here!

        }

        pos = items.indexOf( '-o' );

        if ( pos >= 0 ) {

            texParams.offset.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
            items.splice( pos, 4 ); // we expect 3 parameters here!

        }

        texParams.url = items.join( ' ' ).trim();
        return texParams;

    }

    loadTexture( url: string, mapping?: string, onLoad?: () => void, onProgress?: (progress: number) => void, onError?: (error: string) => void ) {

        var texture;
        var manager = ( this.manager !== undefined ) ? this.manager : DefaultLoadingManager;
        var loader = manager.getHandler( url );

        if ( loader === null ) {

            loader = new TextureLoader( manager );

        }

        if ( loader.setCrossOrigin ) loader.setCrossOrigin( this.crossOrigin );
        texture = (loader as any).load( url, onLoad, onProgress, onError );

        if ( mapping !== undefined ) texture.mapping = mapping;

        return texture;

    }

};

export { MTLLoader, MaterialCreator };
