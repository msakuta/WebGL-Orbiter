import * as THREE from 'three/build/three.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import "./main.css";

import { CelestialBody, addPlanet } from './CelestialBody';
import { Settings, SettingsControl } from './SettingsControl';
import { TimeScaleControl } from './TimeScaleControl';


import orbitIconUrl from './images/orbitIcon.png';
import perlinUrl from './images/perlin.jpg';
import progradeUrl from './images/prograde.png';
import retrogradeUrl from './images/retrograde.png';
import rotateUpUrl from './images/rotate-up.png';
import rotateDownUrl from './images/rotate-down.png';
import rotateLeftUrl from './images/rotate-left.png';
import rotateRightUrl from './images/rotate-right.png';
import rotateCwUrl from './images/rotate-cw.png';
import rotateCcwUrl from './images/rotate-ccw.png';
import closeIconUrl from './images/closeIcon.png';
import menuIconUrl from './images/menuIcon.png';
import loadIconUrl from './images/loadIcon.png';
import saveIconUrl from './images/saveIcon.png';
import statsIconUrl from './images/statsIcon.png';
import trashcanUrl from './images/trashcan.png';
import navballUrl from './images/navball.png';
import watermarkUrl from './images/watermark.png';
import backgroundUrl from './images/hipparcoscyl1.jpg';
import moonUrl from './images/moon.png';
import mercuryUrl from './images/mercury.jpg';
import marsUrl from './images/mars.jpg';
import venusUrl from './images/venus.jpg';
import jupiterUrl from './images/jupiter.jpg';
import earthUrl from './images/land_ocean_ice_cloud_2048.jpg';
import throttleMaxUrl from './images/throttle-max.png';
import throttleMinUrl from './images/throttle-min.png';
import throttleBackUrl from './images/throttle-back.png';
import throttleHandleUrl from './images/throttle-handle.png';
import rocketModelUrl from './rocket.obj';

;(function(){
'use strict'
var container, stats;
var camera, scene, renderer;
var group;
var background;
var overlay, overlayCamera;
var navballMesh, prograde, retrograde;
var timescaleControl;
var throttleControl;
var speedControl;
var orbitalElementControl;
var statsControl;
var settingsControl;
var altitudeControl;
var messageControl;
var cameraControls;
var grids;
var scenarioSelectorControl;
var saveControl;
var loadControl;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
var viewScale = 100;

var simTime, startTime;
var realTime;
var center_select = false;
var select_idx = 0;
var select_obj = null;
var settings = new Settings();

var buttons = {
	up: false,
	down: false,
	left: false,
	right: false,
	counterclockwise: false,
	clockwise: false,
};
var accelerate = false;
var decelerate = false;

var sun;
var light;

var selectedOrbitMaterial;

var AU = 149597871; // Astronomical unit in kilometers
var GMsun = 1.327124400e11 / AU / AU/ AU; // Product of gravitational constant (G) and Sun's mass (Msun)
var epsilon = 1e-40; // Doesn't the machine epsilon depend on browsers!??
var timescale = 1e0; // This is not a constant; it can be changed by the user
var rad_per_deg = Math.PI / 180; // Radians per degrees
var navballRadius = 64;

function AxisAngleQuaternion(x, y, z, angle){
	var q = new THREE.Quaternion();
	q.setFromAxisAngle(new THREE.Vector3(x, y, z), angle);
	return q;
}

function init() {

	container = document.createElement( 'div' );
	document.body.appendChild(container);

	var headerTitle = document.createElement('div');
	headerTitle.id = 'info';
	headerTitle.innerHTML = 'Orbital rocket simulation demo - powered by <a href="http://threejs.org" target="_blank">three.js</a>';
	document.body.appendChild(headerTitle);

	var metaViewport = document.createElement('meta');
	metaViewport.setAttribute('name', 'viewport');
	metaViewport.setAttribute('content', "width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0");
	document.head.appendChild(metaViewport);

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.y = 300;
	camera.position.z = 1000;
	camera.up.set(0,0,1);

	background = new THREE.Scene();
	background.rotation.x = Math.PI / 2;
	var loader = new THREE.TextureLoader();
	loader.load( backgroundUrl, function ( texture ) {

		var geometry = new THREE.SphereGeometry( 2, 20, 20 );

		var material = new THREE.MeshBasicMaterial( { map: texture, depthTest: false, depthWrite: false, side: THREE.BackSide } );
		material.depthWrite = false;
		var mesh = new THREE.Mesh(geometry, material);
		background.add(mesh);

	} );

	overlayCamera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, -1000, 1000 );
	window.addEventListener('resize', function(){
		overlayCamera.left = window.innerWidth / - 2;
		overlayCamera.right = window.innerWidth / 2;
		overlayCamera.top = window.innerHeight / 2;
		overlayCamera.bottom = window.innerHeight / - 2;
		overlayCamera.updateProjectionMatrix();
	});

	overlay = new THREE.Scene();
	var loader = new THREE.TextureLoader();
	loader.load( navballUrl, function ( texture ) {

		var geometry = new THREE.SphereGeometry( navballRadius, 20, 20 );

		var material = new THREE.MeshBasicMaterial( { map: texture, depthTest: false, depthWrite: false } );
		navballMesh = new THREE.Mesh(geometry, material);
		overlay.add(navballMesh);

		var spriteMaterial = new THREE.SpriteMaterial({
			map: new THREE.TextureLoader().load( watermarkUrl ),
			depthTest: false,
			depthWrite: false,
			transparent: true,
		});
		var watermark = new THREE.Sprite(spriteMaterial);
		watermark.scale.set(64, 32, 64);
		navballMesh.add(watermark);
	} );

	var spriteGeometry = new THREE.PlaneGeometry( 40, 40 );
    prograde = new THREE.Mesh(spriteGeometry,
		new THREE.MeshBasicMaterial({
			map: new THREE.TextureLoader().load( progradeUrl ),
			color: 0xffffff,
			side: THREE.DoubleSide,
			depthTest: false,
			depthWrite: false,
			transparent: true,
		} )
	);
    overlay.add(prograde);
	retrograde = new THREE.Mesh(spriteGeometry,
		new THREE.MeshBasicMaterial({
			map: new THREE.TextureLoader().load( retrogradeUrl ),
			color: 0xffffff,
			side: THREE.DoubleSide,
			depthTest: false,
			depthWrite: false,
			transparent: true,
		} )
	);
    overlay.add(retrograde);

	scene = new THREE.Scene();

	group = new THREE.Object3D();
	scene.add( group );

	var material = new THREE.PointsMaterial( { size: 0.1 } );

	// Sun
	var Rsun = 695800.;
	var sgeometry = new THREE.SphereGeometry( Rsun / AU * viewScale, 20, 20 );

	var sunMesh = new THREE.Mesh( sgeometry, material );
	group.add( sunMesh );

	// Sun light
	light = new THREE.PointLight( 0xffffff, 1, 0, 1e-6 );
	scene.add( light );
	scene.add( new THREE.AmbientLight( 0x202020 ) );

	var meshMaterial = new THREE.LineBasicMaterial({color: 0x3f3f3f});
	var meshGeometry = new THREE.Geometry();
	for(var x = -10; x <= 10; x++)
		meshGeometry.vertices.push( new THREE.Vector3( -10, x, 0 ), new THREE.Vector3(10, x, 0));
	for(var x = -10; x <= 10; x++)
		meshGeometry.vertices.push( new THREE.Vector3( x, -10, 0 ), new THREE.Vector3(x, 10, 0));
	grids = new THREE.Object3D();
	var mesh = new THREE.LineSegments(meshGeometry, meshMaterial);
	mesh.scale.x = mesh.scale.y = 100;
	grids.add(mesh);
	var mesh2 = new THREE.LineSegments(meshGeometry, meshMaterial);
	mesh2.scale.x = mesh2.scale.y = 10000 / AU * 100;
	grids.add(mesh2);

	function addAxis(axisVector, color){
		var axisXMaterial = new THREE.LineBasicMaterial({color: color});
		var axisXGeometry = new THREE.Geometry();
		axisXGeometry.vertices.push(new THREE.Vector3(0,0,0), axisVector);
		var axisX = new THREE.Line(axisXGeometry, axisXMaterial);
		axisX.scale.multiplyScalar(100);
		grids.add(axisX);
	}
	addAxis(new THREE.Vector3(100,0,0), 0xff0000);
	addAxis(new THREE.Vector3(0,100,0), 0x00ff00);
	addAxis(new THREE.Vector3(0,0,100), 0x0000ff);

	scene.add(grids);

	var orbitMaterial = new THREE.LineBasicMaterial({color: 0x3f3f7f});
	CelestialBody.prototype.orbitMaterial = orbitMaterial; // Default orbit material
	selectedOrbitMaterial = new THREE.LineBasicMaterial({color: 0xff7fff});
	var orbitGeometry = new THREE.Geometry();
	var curve = new THREE.EllipseCurve(0, 0, 1, 1,
		0, Math.PI * 2, false, 90);
	var orbitGeometry = new THREE.Geometry().setFromPoints( curve.getPoints(256) );

	function AddPlanet(semimajor_axis, eccentricity, inclination, ascending_node, argument_of_perihelion, color, GM, parent, texture, radius, params, name){
		return addPlanet(semimajor_axis, eccentricity, inclination, ascending_node, argument_of_perihelion, color, GM, parent, texture, radius, params, name,
			scene, viewScale, overlay, orbitGeometry, center_select, settings, camera, windowHalfX, windowHalfY);
	}

	sun = new CelestialBody(null, new THREE.Vector3(), null, 0xffffff, GMsun, "sun");
	sun.radius = Rsun;
	sun.model = group;
	var mercury = AddPlanet(0.387098, 0.205630, 7.005 * rad_per_deg, 48.331 * rad_per_deg, 29.124 * rad_per_deg, 0x3f7f7f, 22032 / AU / AU / AU, sun, mercuryUrl, 2439.7, {soi: 2e5}, "mercury");
	var venus = AddPlanet(0.723332, 0.00677323, 3.39458 * rad_per_deg, 76.678 * rad_per_deg, 55.186 * rad_per_deg, 0x7f7f3f, 324859 / AU / AU / AU, sun, venusUrl, 6051.8, {soi: 5e5}, "mars");
	// Earth is at 1 AU (which is the AU's definition) and orbits around the ecliptic.
	var earth = AddPlanet(1, 0.0167086, 0, -11.26064 * rad_per_deg, 114.20783 * rad_per_deg, 0x3f7f3f, 398600 / AU / AU / AU, sun, earthUrl, 6534,
		{axialTilt: 23.4392811 * rad_per_deg,
		rotationPeriod: ((23 * 60 + 56) * 60 + 4.10),
		soi: 5e5}, "earth");
	var rocket = AddPlanet(10000 / AU, 0., 0, 0, 0, 0x3f7f7f, 100 / AU / AU / AU, earth, undefined, 0.1, {modelName: rocketModelUrl, controllable: true}, "rocket");
	rocket.quaternion.multiply(AxisAngleQuaternion(1, 0, 0, Math.PI / 2)).multiply(AxisAngleQuaternion(0, 1, 0, Math.PI / 2));
	var moon = AddPlanet(384399 / AU, 0.0167086, 0, -11.26064 * rad_per_deg, 114.20783 * rad_per_deg, 0x5f5f5f, 4904.8695 / AU / AU / AU, earth, moonUrl, 1737.1, {soi: 1e5}, "moon");
	var mars = AddPlanet(1.523679, 0.0935, 1.850 * rad_per_deg, 49.562 * rad_per_deg, 286.537 * rad_per_deg, 0x7f3f3f, 42828 / AU / AU / AU, sun, marsUrl, 3389.5, {soi: 3e5}, "mars");
	var jupiter = AddPlanet(5.204267, 0.048775, 1.305 * rad_per_deg, 100.492 * rad_per_deg, 275.066 * rad_per_deg, 0x7f7f3f, 126686534 / AU / AU / AU, sun, jupiterUrl, 69911, {soi: 10e6}, "jupiter");
	select_obj = rocket;
	center_select = true;
	camera.position.set(0.005, 0.003, 0.005);

	// Use icosahedron instead of sphere to make it look like uniform
	var asteroidGeometry = new THREE.IcosahedronGeometry( 1, 2 );
	// Modulate the vertices randomly to make it look like an asteroid. Simplex noise is desirable.
	for(var i = 0; i < asteroidGeometry.vertices.length; i++){
		asteroidGeometry.vertices[i].multiplyScalar(0.3 * (Math.random() - 0.5) + 1);
	}
	// Recalculate normal vectors according to updated vertices
	asteroidGeometry.computeFaceNormals();
	asteroidGeometry.computeVertexNormals();

	// Perlin noise is applied as detail texture.
	// It's asynchrnonous because it's shared by multiple asteroids.
	var asteroidTexture = new THREE.TextureLoader().load(perlinUrl);
	asteroidTexture.wrapS = THREE.RepeatWrapping;
	asteroidTexture.wrapT = THREE.RepeatWrapping;
	asteroidTexture.repeat.set(4, 4);
	var asteroidMaterial = new THREE.MeshLambertMaterial( {
		map: asteroidTexture,
		color: 0xffaf7f, flatShading: false
	} );

	// Randomly generate asteroids
	for ( i = 0; i < 3; i ++ ) {

		var angle = Math.random() * Math.PI * 2;
		var position = new THREE.Vector3();
		position.x = 0.1 * (Math.random() - 0.5);
		position.y = 0.1 * (Math.random() - 0.5) + 1;
		position.z = 0.1 * (Math.random() - 0.5);
		position.applyQuaternion(AxisAngleQuaternion(0, 0, 1, angle));

		position.multiplyScalar(2.5);
		var asteroid = new CelestialBody(sun, position, undefined, undefined, undefined, "asteroid" + i);
		asteroid.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.3 - 1, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)
			.multiplyScalar(Math.sqrt(GMsun / position.length())).applyQuaternion(AxisAngleQuaternion(0, 0, 1, angle));

		asteroid.radius = Math.random() * 1 + 0.1;
		// We need nested Object3D for NLIPS
		asteroid.model = new THREE.Object3D();
		// The inner Mesh object has scale determined by radius
		var shape = new THREE.Mesh( asteroidGeometry, asteroidMaterial );
		asteroid.model.add(shape);
		var radiusInAu = viewScale * asteroid.radius / AU;
		shape.scale.set(radiusInAu, radiusInAu, radiusInAu);
		shape.up.set(0,0,1);
		scene.add( asteroid.model );

		var orbitMesh = new THREE.Line(orbitGeometry, asteroid.orbitMaterial);
		asteroid.orbit = orbitMesh;
		scene.add(orbitMesh);

		asteroid.init();
		asteroid.update(center_select, viewScale, settings.nlips_enable, camera, windowHalfX, windowHalfY,
			settings.units_km, (_) => {}, scene);

	}

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor( 0x000000 );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.autoClear = false;

	cameraControls = new OrbitControls(camera, renderer.domElement);
	cameraControls.target.set( 0, 0, 0);
	cameraControls.enablePan = false;
	cameraControls.maxDistance = 4000;
	cameraControls.minDistance = 1 / AU;
	cameraControls.zoomSpeed = 5.;
	cameraControls.update();

	container.appendChild( renderer.domElement );

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	container.appendChild( stats.domElement );

	timescaleControl = new TimeScaleControl(
		(scale) => {
			if(select_obj && 0 < select_obj.throttle){
				messageControl.setText('You cannot timewarp while accelerating');
				return false;
			}
			timescale = scale;
			return true;
	});
	container.appendChild( timescaleControl.domElement );

	throttleControl = new (function(){
		function updatePosition(pos){
			if(1 < timescale && 0 < pos){
				messageControl.setText('You cannot accelerate while timewarping');
				return;
			}
			visualizePosition(pos);
		}
		function visualizePosition(pos){
			var backRect = element.getBoundingClientRect();
			var rect = throttleBack.getBoundingClientRect();
			var handleRect = handle.getBoundingClientRect();
			var max = rect.height - handleRect.height;
			handle.style.top = (1 - pos) * max + (rect.top - backRect.top) + 'px';
			if(select_obj.throttle === 0. && 0. < pos)
				select_obj.ignitionCount++;
			select_obj.throttle = pos;
			if(select_obj && select_obj.blastModel){
				select_obj.blastModel.visible = 0 < select_obj.throttle;
				var size = (select_obj.throttle + 0.1) / 1.1;
				select_obj.blastModel.scale.set(size, size, size);
			}
		}
		function movePosition(event){
			var rect = throttleBack.getBoundingClientRect();
			var handleRect = handle.getBoundingClientRect();
			var max = rect.height - handleRect.height;
			var pos = Math.min(max, Math.max(0, (event.clientY - rect.top) - handleRect.height / 2));
			updatePosition(1 - pos / max);
		}
		var guideHeight = 128;
		var guideWidth = 32;
		this.domElement = document.createElement('div');
		this.domElement.style.position = 'absolute';
		this.domElement.style.top = (window.innerHeight - guideHeight) + 'px';
		this.domElement.style.left = (windowHalfX - navballRadius - guideWidth) + 'px';
		this.domElement.style.background = '#7f7f7f';
		this.domElement.style.zIndex = 10;
		var element = this.domElement;
		var dragging = false;
		var scope = this;
		var throttleMax = document.createElement('img');
		throttleMax.src = throttleMaxUrl;
		throttleMax.style.position = "absolute";
		throttleMax.style.left = '0px';
		throttleMax.style.top = '0px';
		throttleMax.onmousedown = function(event){
			scope.setThrottle(1);
		};
		throttleMax.ondragstart = function(event){
			event.preventDefault();
		};
		this.domElement.appendChild(throttleMax);
		var throttleBack = document.createElement('img');
		throttleBack.src = throttleBackUrl;
		throttleBack.style.position = "absolute";
		throttleBack.style.left = '0px';
		throttleBack.style.top = '25px';
		throttleBack.onmousedown = function(event){
			dragging = true;
			movePosition(event);
		};
		throttleBack.onmousemove = function(event){
			if(dragging && event.buttons & 1)
				movePosition(event);
		};
		throttleBack.onmouseup = function(event){
			dragging = false;
		}
		throttleBack.draggable = true;
		throttleBack.ondragstart = function(event){
			event.preventDefault();
		};
		this.domElement.appendChild(throttleBack);
		var throttleMin = document.createElement('img');
		throttleMin.src = throttleMinUrl;
		throttleMin.style.position = "absolute";
		throttleMin.style.left = '0px';
		throttleMin.style.top = '106px';
		throttleMin.onmousedown = function(event){
			scope.setThrottle(0);
		};
		throttleMin.ondragstart = function(event){
			event.preventDefault();
		};
		this.domElement.appendChild(throttleMin);
		var handle = document.createElement('img');
		handle.src = throttleHandleUrl;
		handle.style.position = 'absolute';
		handle.style.top = (guideHeight - 16) + 'px';
		handle.style.left = '0px';
		handle.onmousemove = throttleBack.onmousemove;
		handle.onmousedown = throttleBack.onmousedown;
		handle.onmouseup = throttleBack.onmouseup;
		handle.ondragstart = throttleBack.ondragstart;
		this.domElement.appendChild(handle);
		this.increment = function(delta){
			if(select_obj)
				updatePosition(Math.min(1, select_obj.throttle + delta));
		}
		this.decrement = function(delta){
			if(select_obj)
				updatePosition(Math.max(0, select_obj.throttle - delta));
		}
		this.setThrottle = function(value){
			updatePosition(value);
		}
		window.addEventListener('resize', function(){
			element.style.top = (window.innerHeight - guideHeight) + 'px';
			element.style.left = (window.innerWidth / 2 - navballRadius - guideWidth) + 'px';
		});
		window.addEventListener('load', function(){
			visualizePosition(select_obj.throttle);
		});
	})();
	container.appendChild( throttleControl.domElement );

	var rotationControl = new (function(){
		function setSize(){
			rootElement.style.top = (window.innerHeight - 2 * navballRadius) + 'px';
			rootElement.style.left = (window.innerWidth / 2 - navballRadius) + 'px';
		}

		function absorbEvent_(event) {
			var e = event || window.event;
			e.preventDefault && e.preventDefault();
			e.stopPropagation && e.stopPropagation();
			e.cancelBubble = true;
			e.returnValue = false;
			return false;
		}

		function addArrow(src, key, left, top){
			var button = document.createElement('img');
			button.src = src;
			button.width = buttonWidth;
			button.height = buttonHeight;
			button.style.position = 'absolute';
			button.style.top = top + 'px';
			button.style.left = left + 'px';
			button.onmousedown = function(event){
				buttons[key] = true;
			};
			button.onmouseup = function(event){
				buttons[key] = false;
				button.style.boxShadow = '';
			}
			button.ondragstart = function(event){
				event.preventDefault();
			};
			button.ontouchstart = function(event){
				buttons[key] = true;
				event.preventDefault();
				event.stopPropagation();
			};
			button.ontouchmove = absorbEvent_;
			button.ontouchend = function(event){
				buttons[key] = false;
				button.style.boxShadow = '';
				event.preventDefault();
				event.stopPropagation();
			};
			button.ontouchcancel = absorbEvent_;
			element.appendChild(button);
		}
		var buttonHeight = 32;
		var buttonWidth = 32;
		this.domElement = document.createElement('div');
		var rootElement = this.domElement;
		this.domElement.style.position = 'absolute';
		this.domElement.style.width = (navballRadius * 2) + 'px';
		this.domElement.style.height = (navballRadius * 2) + 'px';
		setSize();
		this.domElement.style.zIndex = 5;
		// Introduce internal 'div' because the outer 'div' cannot be
		// hidden since it need to receive mouseenter event.
		var element = document.createElement('div');
		element.style.width = '100%';
		element.style.height = '100%';
		element.style.display = 'none';
		this.domElement.appendChild(element);
		this.domElement.onmouseenter = function(event){
			element.style.display = 'block';
		};
		this.domElement.onmouseleave = function(event){
			element.style.display = 'none';
			buttons.up = buttons.down = buttons.left = buttons.right = false;
		};
		addArrow(rotateUpUrl, 'up', navballRadius - buttonWidth / 2, 0);
		addArrow(rotateDownUrl, 'down', navballRadius - buttonWidth / 2, 2 * navballRadius - buttonHeight);
		addArrow(rotateLeftUrl, 'left', 0, navballRadius - buttonHeight / 2);
		addArrow(rotateRightUrl, 'right', 2 * navballRadius - buttonWidth, navballRadius - buttonHeight / 2);
		addArrow(rotateCwUrl, 'clockwise', 2 * navballRadius - buttonWidth, 0);
		addArrow(rotateCcwUrl, 'counterclockwise', 0, 0);
		window.addEventListener('resize', setSize);
	})();
	container.appendChild( rotationControl.domElement );

	speedControl = new (function(){
		function setSize(){
			element.style.top = (window.innerHeight - 2 * navballRadius - 32) + 'px';
			element.style.left = (window.innerWidth / 2 - element.getBoundingClientRect().width / 2) + 'px';
		}
		var buttonHeight = 32;
		var buttonWidth = 32;
		this.domElement = document.createElement('div');
		var element = this.domElement;
		element.style.position = 'absolute';
		setSize();
		element.style.zIndex = 7;
		element.style.background = 'rgba(0, 0, 0, 0.5)';
		window.addEventListener('resize', setSize);
		var title = document.createElement('div');
		title.innerHTML = 'Orbit';
		element.appendChild(title);
		var valueElement = document.createElement('div');
		element.appendChild(valueElement);
		this.setSpeed = function(){
			if(select_obj){
				var value = select_obj.velocity.length() * AU;
				if(value < 1)
					valueElement.innerHTML = (value * 1000).toFixed(4) + 'm/s';
				else
					valueElement.innerHTML = value.toFixed(4) + 'km/s';
			}
			else
				valueElement.innerHTML = '';
			element.style.left = (window.innerWidth / 2 - element.getBoundingClientRect().width / 2) + 'px';
		}
	})();
	container.appendChild( speedControl.domElement );

	orbitalElementControl = new (function(){
		var buttonHeight = 32;
		var buttonWidth = 32;
		this.domElement = document.createElement('div');
		var element = this.domElement;
		element.style.position = 'absolute';
		element.style.textAlign = 'left';
		element.style.top = 120 + 'px';
		element.style.left = 0 + 'px';
		element.style.zIndex = 7;
		var visible = false;
		var icon = document.createElement('img');
		icon.src = orbitIconUrl;
		element.appendChild(icon);

		var title = document.createElement('div');
		title.innerHTML = 'Orbital Elements';
		title.style.display = 'none';
		element.appendChild(title);

		var valueElement = document.createElement('div');
		element.appendChild(valueElement);
		valueElement.id = 'orbit';
		valueElement.style.display = 'none';

		// Register event handlers
		icon.ondragstart = function(event){
			event.preventDefault();
		};
		icon.onclick = function(event){
			visible = !visible;
			if(visible){
				valueElement.style.display = 'block';
				element.style.background = 'rgba(0, 0, 0, 0.5)';
			}
			else{
				valueElement.style.display = 'none';
				element.style.background = 'rgba(0, 0, 0, 0)';
			}
		};
		icon.onmouseenter = function(event){
			if(!visible)
				title.style.display = 'block';
		};
		icon.onmouseleave = function(event){
			if(!visible)
				title.style.display = 'none';
		};

		this.setText = function(text){
			valueElement.innerHTML = text;
		}
	})();
	container.appendChild( orbitalElementControl.domElement );

	function rightTitleSetSize(title, icon){
		var r = title.getBoundingClientRect();
		var iconRect = icon.getBoundingClientRect()
		title.style.top = (iconRect.height - r.height) + 'px';
		title.style.right = iconRect.width + 'px';
	}

	statsControl = new (function(){
		function setSize(){
			element.style.left = (window.innerWidth - buttonWidth) + 'px';
			rightTitleSetSize(title, icon);
		}
		var buttonTop = 120;
		var buttonHeight = 32;
		var buttonWidth = 32;
		this.domElement = document.createElement('div');
		var element = this.domElement;
		element.style.position = 'absolute';
		element.style.textAlign = 'left';
		element.style.top = buttonTop + 'px';
		element.style.left = 0 + 'px';
		element.style.zIndex = 7;
		var visible = false;
		var icon = document.createElement('img');
		icon.src = statsIconUrl;
		icon.style.width = buttonWidth + 'px';
		icon.style.height = buttonHeight + 'px';
		element.appendChild(icon);

		var title = document.createElement('div');
		title.innerHTML = 'Statistics';
		title.style.display = 'none';
		title.style.position = 'absolute';
		title.style.top = buttonTop + 'px';
		title.style.background = 'rgba(0, 0, 0, 0.5)';
		title.style.zIndex = 20;
		element.appendChild(title);

		var valueElement = document.createElement('div');
		element.appendChild(valueElement);
		valueElement.style.display = 'none';
		valueElement.style.position = 'absolute';
		valueElement.style.background = 'rgba(0, 0, 0, 0.5)';
		valueElement.style.border = '3px ridge #7f3f3f';
		valueElement.style.padding = '3px';
		var valueElements = [];
		for(var i = 0; i < 3; i++){
			var titleElement = document.createElement('div');
			titleElement.innerHTML = ['Mission Time', 'Delta-V', 'Ignition&nbsp;Count'][i];
			titleElement.style.fontWeight = 'bold';
			titleElement.style.paddingRight = '1em';
			valueElement.appendChild(titleElement);
			var valueElementChild = document.createElement('div');
			valueElementChild.style.textAlign = 'right';
			valueElements.push(valueElementChild);
			valueElement.appendChild(valueElementChild);
		}

		setSize();

		// Register event handlers
		window.addEventListener('resize', setSize);
		icon.ondragstart = function(event){
			event.preventDefault();
		};
		icon.onclick = function(event){
			visible = !visible;
			if(visible){
				valueElement.style.display = 'block';
				element.style.background = 'rgba(0, 0, 0, 0.5)';
			}
			else{
				valueElement.style.display = 'none';
				element.style.background = 'rgba(0, 0, 0, 0)';
				settingsControl.domElement.style.top = element.getBoundingClientRect().bottom + 'px';
			}
		};
		icon.onmouseenter = function(event){
			if(!visible)
				title.style.display = 'block';
			rightTitleSetSize(title, icon);
		};
		icon.onmouseleave = function(event){
			if(!visible)
				title.style.display = 'none';
		};

		this.setText = function(text){
			if(!visible)
				return;
			if(!select_obj){
				valueElements[3].innerHTML = valueElements[2] = '';
				return;
			}
			var totalSeconds = (simTime.getTime() - startTime.getTime()) / 1e3;
			var seconds = Math.floor(totalSeconds) % 60;
			var minutes = Math.floor(totalSeconds / 60) % 60;
			var hours = Math.floor(totalSeconds / 60 / 60) % 24;
			var days = Math.floor(totalSeconds / 60 / 60 / 24);
			valueElements[0].innerHTML = days + 'd ' + zerofill(hours) + ':' + zerofill(minutes) + ':' + zerofill(seconds);
			var deltaVkm = select_obj.totalDeltaV * AU;
			var deltaV;
			if(deltaVkm < 10)
				deltaV = (deltaVkm * 1e3).toFixed(1) + 'm/s';
			else
				deltaV = deltaVkm.toFixed(4) + 'km/s';
			valueElements[1].innerHTML = deltaV;
			valueElements[2].innerHTML = select_obj.ignitionCount;
			valueElement.style.marginLeft = (buttonWidth - valueElement.getBoundingClientRect().width) + 'px';
			settingsControl.domElement.style.top = valueElement.getBoundingClientRect().bottom + 'px';
		}
	})();
	container.appendChild( statsControl.domElement );

	settingsControl = new SettingsControl(settings);
	container.appendChild( settingsControl.domElement );

	altitudeControl = new (function(){
		var buttonHeight = 32;
		var buttonWidth = 32;
		this.domElement = document.createElement('div');
		var element = this.domElement;
		element.style.position = 'absolute';
		element.style.top = '2em';
		element.style.left = '50%';
		element.style.background = 'rgba(0,0,0,0.5)';
		element.style.zIndex = 8;
		var visible = false;

		// Register event handlers
		element.ondragstart = function(event){
			event.preventDefault();
		};

		this.setText = function(value){
			var text;
			if(value < 1e5)
				text = value.toFixed(4) + 'km';
			else if(value < 1e8)
				text = (value / 1000).toFixed(4) + 'Mm';
			else
				text = (value / AU).toFixed(4) + 'AU';
			element.innerHTML = text;
			element.style.marginLeft = -element.getBoundingClientRect().width / 2 + 'px';
		};
	})();
	container.appendChild( altitudeControl.domElement );

	messageControl = new (function(){
		this.domElement = document.createElement('div');
		var element = this.domElement;
		element.style.position = 'absolute';
		element.style.top = '25%';
		element.style.left = '50%';
		element.style.fontSize = '20px';
		element.style.fontWeight = 'bold';
		element.style.textShadow = '0px 0px 5px rgba(0,0,0,1)';
		element.style.zIndex = 20;
		var showTime = 0;

		// Register event handlers
		element.ondragstart = function(event){
			event.preventDefault();
		};
		// Disable text selection
		element.onselectstart = function(){ return false; }

		this.setText = function(text){
			element.innerHTML = text;
			element.style.display = 'block';
			element.style.opacity = '1';
			element.style.marginTop = -element.getBoundingClientRect().height / 2 + 'px';
			element.style.marginLeft = -element.getBoundingClientRect().width / 2 + 'px';
			showTime = 5; // Seconds to show should depend on text length!
		};

		this.timeStep = function(deltaTime){
			if(showTime < deltaTime){
				element.style.display = 'none';
				showTime = 0;
				return;
			}
			showTime -= deltaTime;
			if(showTime < 2);
				element.style.opacity = (showTime / 2).toString();
		}
	})
	container.appendChild( messageControl.domElement );

	function MenuControl(titleString, iconSrc, config){
		this.domElement = document.createElement('div');
		var element = this.domElement;
		element.style.position = 'absolute';
		element.style.textAlign = 'left';
		element.style.top = config.buttonTop + 'px';
		element.style.right = 0 + 'px';
		element.style.zIndex = 7;
		this.icon = document.createElement('img');
		this.icon.src = iconSrc;
		this.icon.style.width = config.buttonWidth + 'px';
		this.icon.style.height = config.buttonHeight + 'px';
		var scope = this;
		this.iconMouseOver = false;
		this.icon.ondragstart = function(event){
			event.preventDefault();
		};
		this.icon.onclick = function(event){
			scope.setVisible(!scope.visible);
		};
		this.icon.onmouseenter = function(event){
			if(!scope.visible)
				scope.title.style.display = 'block';
			rightTitleSetSize(scope.title, scope.icon);
			scope.iconMouseOver = true;
		};
		this.icon.onmouseleave = function(event){
			if(!scope.visible)
				scope.title.style.display = 'none';
			scope.iconMouseOver = false;
		};
		element.appendChild(this.icon);

		var title = document.createElement('div');
		title.innerHTML = titleString;
		title.style.display = 'none';
		title.style.position = 'absolute';
		title.style.background = 'rgba(0, 0, 0, 0.5)';
		title.style.zIndex = 20;
		element.appendChild(title);
		this.title = title;

		this.visible = false;

		var valueElement = document.createElement('div');
		valueElement.style.cssText = "display: none; position: fixed; left: 50%;"
			+ "width: 300px; top: 50%; background-color: rgba(0,0,0,0.85); border: 5px ridge #7fff7f;"
			+ "font-size: 15px; text-align: center; font-family: Sans-Serif";
		this.valueElement = valueElement;

		var titleElem = document.createElement('div');
		titleElem.style.margin = "15px";
		titleElem.style.padding = "15px";
		titleElem.style.fontSize = '25px';
		titleElem.innerHTML = config.innerTitle || titleString;
		this.valueElement.appendChild(titleElem);

		this.closeIcon = document.createElement('img');
		this.closeIcon.src = closeIconUrl;
		this.closeIcon.style.cssText = 'position: absolute; top: 0px; right: 0px; border: inset 1px #7f7f7f;';
		this.closeIcon.ondragstart = function(event){
			event.preventDefault();
		};
		this.closeIcon.onclick = function(event){
			scope.setVisible(false);
		};
		this.valueElement.appendChild(this.closeIcon);

		this.domElement.appendChild(this.valueElement);
	};

	MenuControl.prototype.setVisible = function(v){
		this.visible = v;
		if(this.visible){
			this.valueElement.style.display = 'block';
			var rect = this.valueElement.getBoundingClientRect();
			this.valueElement.style.marginLeft = -rect.width / 2 + "px";
			this.valueElement.style.marginTop = -rect.height / 2 + "px";
		}
		else{
			this.valueElement.style.display = 'none';
			if(!this.iconMouseOver)
				this.title.style.display = 'none';
		}
	};

	scenarioSelectorControl = new (function(){
		var config = {
			buttonTop: 0,
			buttonHeight: 32,
			buttonWidth: 32,
			innerTitle: "Scenario Selector",
		};
		var scope = this;
		MenuControl.call(this, 'Scenarios', menuIconUrl, config);

		this.valueElement.style.border = "5px ridge #ffff7f";
		var scenarios = [
			{title: "Earth orbit", parent: earth, semimajor_axis: 10000 / AU},
			{title: "Moon orbit", parent: moon, semimajor_axis: 3000 / AU},
			{title: "Mars orbit", parent: mars, semimajor_axis: 5000 / AU},
			{title: "Venus orbit", parent: venus, semimajor_axis: 10000 / AU, ascending_node: Math.PI},
			{title: "Jupiter orbit", parent: jupiter, semimajor_axis: 100000 / AU},
		];
		for(var i = 0; i < scenarios.length; i++){
			var elem = document.createElement('div');
			elem.style.margin = "15px";
			elem.style.padding = "15px";
			elem.style.border = "1px solid #ffff00";
			elem.innerHTML = scenarios[i].title;
			elem.onclick = (function(scenario){
				return function(){
					var ascending_node = scenario.ascending_node || 0.;
					var eccentricity = scenario.eccentricity || 0.;
					var rotation = scenario.rotation || (function(){
						var rotation = AxisAngleQuaternion(0, 0, 1, ascending_node - Math.PI / 2);
						rotation.multiply(AxisAngleQuaternion(0, 1, 0, Math.PI));
						return rotation;
					})();
					rocket.setParent(scenario.parent);
					rocket.position = new THREE.Vector3(0, 1 - eccentricity, 0)
						.multiplyScalar(scenario.semimajor_axis).applyQuaternion(rotation);
					rocket.quaternion = rotation.clone();
					rocket.quaternion.multiply(AxisAngleQuaternion(1, 0, 0, -Math.PI / 2));
					rocket.angularVelocity = new THREE.Vector3();
					throttleControl.setThrottle(0);
					rocket.setOrbitingVelocity(scenario.semimajor_axis, rotation);
					rocket.totalDeltaV = 0.;
					rocket.ignitionCount = 0;
					simTime = new Date();
					realTime = simTime;
					startTime = simTime;
					messageControl.setText('Scenario ' + scenario.title + ' Loaded!');
					scope.title.style.display = 'none';
					scope.visible = false;
					scope.valueElement.style.display = 'none';
				}
			})(scenarios[i]);
			this.valueElement.appendChild(elem);
		}

		this.setVisible = function(v){
			MenuControl.prototype.setVisible.call(this, v);
			if(this.visible){
				[saveControl, loadControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
			}
		}
	});
	container.appendChild( scenarioSelectorControl.domElement );

	function serializeState(){
		return {
			simTime: simTime,
			startTime: startTime,
			bodies: sun.serializeTree(),
		};
	}

	saveControl = new (function(){
		var config = {
			buttonTop: 34,
			buttonHeight: 32,
			buttonWidth: 32,
		};
		var scope = this;
		MenuControl.call(this, 'Save data', saveIconUrl, config);

		var inputContainer = document.createElement('div');
		inputContainer.style.border = "1px solid #7fff7f";
		inputContainer.style.margin = "5px";
		inputContainer.style.padding = "5px";
		var inputTitle = document.createElement('div');
		inputTitle.innerHTML = 'New Save Name';
		var inputElement = document.createElement('input');
		inputElement.setAttribute('type', 'text');
		var inputButton = document.createElement('button');
		inputButton.innerHTML = 'save'
		inputButton.onclick = function(event){
			var saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) : [];
			saveData.push({title: inputElement.value, state: serializeState()});
			localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
			messageControl.setText('Game State Saved!');
			scope.title.style.display = 'none';
			scope.visible = false;
			scope.valueElement.style.display = 'none';
		};
		inputElement.onkeydown = function(e){
			e.stopPropagation();
		}
		inputContainer.appendChild(inputTitle);
		inputContainer.appendChild(inputElement);
		inputContainer.appendChild(inputButton);
		this.valueElement.appendChild(inputContainer);

		var saveContainer = document.createElement('div');

		function updateSaveDataList(){
			while(0 < saveContainer.children.length) saveContainer.removeChild(saveContainer.children[0]);
			var saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) : [];
			for(var i = 0; i < saveData.length; i++){
				var elem = document.createElement('div');
				elem.style.margin = "5px";
				elem.style.padding = "5px";
				elem.style.border = "1px solid #00ff00";
				var labelElem = document.createElement('div');
				labelElem.innerHTML = saveData[i].title;
				labelElem.style.cssText = "width: 100%; margin-right: -32px; display: inline-block; text-align: overflow: auto;";
				elem.appendChild(labelElem);
				var deleteElem = document.createElement('img');
				deleteElem.setAttribute('src', trashcanUrl);
				deleteElem.style.width = '20px';
				deleteElem.onclick = (function(i){
					return function(e){
						saveData.splice(i, 1);
						localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
						messageControl.setText('Game State Deleted!');
						scope.title.style.display = 'none';
						scope.visible = false;
						scope.valueElement.style.display = 'none';
						e.stopPropagation();
					}
				})(i);
				elem.appendChild(deleteElem);
				elem.onclick = (function(save){
					return function(){
						save.state = serializeState();
						localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
						messageControl.setText('Game State Saved!');
						scope.title.style.display = 'none';
						scope.visible = false;
						scope.valueElement.style.display = 'none';
					}
				})(saveData[i]);
				saveContainer.appendChild(elem);
			}
		}
		this.valueElement.appendChild(saveContainer);

		this.setVisible = function(v){
			if(v){
				[scenarioSelectorControl, loadControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
				updateSaveDataList();
			}
			MenuControl.prototype.setVisible.call(this, v);
		}
	});
	container.appendChild( saveControl.domElement );

	function loadState(state){
		simTime = new Date(state.simTime);
		startTime = new Date(state.startTime);
		var bodies = state.bodies;
		for(var i = 0; i < bodies.length; i++){
			var body = bodies[i];
			if(CelestialBody.celestialBodies.has(body.name)){
				CelestialBody.celestialBodies.get(body.name).deserialize(body);
			}
		}
		throttleControl.setThrottle(rocket.throttle);
	}

	loadControl = new (function(){
		var config = {
			buttonTop: 34 * 2,
			buttonHeight: 32,
			buttonWidth: 32,
		};
		MenuControl.call(this, 'Load data', loadIconUrl, config);
		var scope = this;
		this.valueElement.style.border = "5px ridge #ff7fff";

		var saveContainer = document.createElement('div');

		function updateSaveDataList(){
			while(0 < saveContainer.children.length) saveContainer.removeChild(saveContainer.children[0]);
			var saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) : [];
			for(var i = 0; i < saveData.length; i++){
				var elem = document.createElement('div');
				elem.style.margin = "5px";
				elem.style.padding = "5px";
				elem.style.border = "1px solid #ff00ff";
				var labelElem = document.createElement('div');
				labelElem.innerHTML = saveData[i].title;
				labelElem.style.cssText = "width: 100%; margin-right: -32px; display: inline-block; text-align: overflow: auto;";
				elem.appendChild(labelElem);
				var deleteElem = document.createElement('img');
				deleteElem.setAttribute('src', trashcanUrl);
				deleteElem.style.width = '20px';
				deleteElem.onclick = (function(i){
					return function(e){
						saveData.splice(i, 1);
						localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
						messageControl.setText('Game State Deleted!');
						scope.title.style.display = 'none';
						scope.visible = false;
						scope.valueElement.style.display = 'none';
						e.stopPropagation();
					}
				})(i);
				elem.appendChild(deleteElem);
				elem.onclick = (function(save){
					return function(){
						loadState(save.state);
						messageControl.setText('Game State Loaded!');
						scope.title.style.display = 'none';
						scope.visible = false;
						scope.valueElement.style.display = 'none';
					}
				})(saveData[i]);
				saveContainer.appendChild(elem);
			}
		}
		this.valueElement.appendChild(saveContainer);

		this.setVisible = function(v){
			if(v){
				[scenarioSelectorControl, saveControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
				updateSaveDataList();
			}
			MenuControl.prototype.setVisible.call(this, v);
		}
	});
	container.appendChild( loadControl.domElement );

	window.addEventListener( 'resize', onWindowResize, false );
	window.addEventListener( 'keydown', onKeyDown, false );
	window.addEventListener( 'keyup', onKeyUp, false );
	window.addEventListener( 'pageshow', function(){
		var state = localStorage.getItem('WebGLOrbiterAutoSave');
		if(state){
			loadState(JSON.parse(state));
		}
	});
	window.addEventListener( 'beforeunload', function(){
		localStorage.setItem('WebGLOrbiterAutoSave', JSON.stringify(serializeState()));
	});

	// Start the clock after the initialization is finished, otherwise
	// the very first frame of simulation can be long.
	simTime = new Date();
	realTime = simTime;
	startTime = simTime;
}

function onWindowResize() {

	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	requestAnimationFrame( animate );

	render();
	stats.update();

}

// Fills leading zero if the value is less than 10, making the returned string always two characters long.
// Note that values not less than 100 or negative values are not guaranteed to be two characters wide.
// This function is for date time formatting purpose only.
function zerofill(v){
	if(v < 10)
		return "0" + v;
	else
		return v;
}

function render() {
	var now = new Date();
	var realDeltaTimeMilliSec = now.getTime() - realTime.getTime();
	var time = new Date(simTime.getTime() + realDeltaTimeMilliSec * timescale);
	var deltaTime = (time.getTime() - simTime.getTime()) * 1e-3;
	realTime = now;
	simTime = time;
	timescaleControl.setDate(time.getFullYear() + '/' + zerofill(time.getMonth() + 1) + '/' + zerofill(time.getDate())
		+ ' ' + zerofill(time.getHours()) + ':' + zerofill(time.getMinutes()) + ':' + zerofill(time.getSeconds()));
	speedControl.setSpeed();
	statsControl.setText();
	settingsControl.setText();
	messageControl.timeStep(realDeltaTimeMilliSec * 1e-3);

	camera.near = Math.min(1, cameraControls.target.distanceTo(camera.position) / 10);
	camera.updateProjectionMatrix();

	var acceleration = 5e-10;
	var div = 100; // We should pick subdivide simulation step count by angular speed!

	for(var d = 0; d < div; d++){
		// Allow trying to increase throttle when timewarping in order to show the message
		if(accelerate) throttleControl.increment(deltaTime / div);
		if(decelerate) throttleControl.decrement(deltaTime / div);

		sun.simulateBody(deltaTime, div, timescale, buttons, select_obj);
	}

	// Convert length of unit au into a fixed-length string considering user unit selection.
	// Also appends unit string for clarity.
	function unitConvLength(au){
		if(settings.units_km)
			return (au * AU).toPrecision(10) + ' km';
		else
			return au.toFixed(10) + ' AU';
	}

	sun.update(center_select, viewScale, settings.nlips_enable, camera, windowHalfX, windowHalfY,
		settings.units_km,
		function(o, headingApoapsis){
			orbitalElementControl.setText(
				'<table class="table1">'
				+ ' <tr><td>e</td><td>' + (o.eccentricity || 0).toFixed(10) + '</td></tr>'
				+ ' <tr><td>a</td><td>' + unitConvLength(o.semimajor_axis) + '</td></tr>'
				+ ' <tr><td>i</td><td>' + (o.inclination / Math.PI).toFixed(10) + '</td></tr>'
				+ ' <tr><td>Omega</td><td>' + (o.ascending_node / Math.PI).toFixed(10) + '</td></tr>'
				+ ' <tr><td>w</td><td>' + (o.argument_of_perihelion / Math.PI).toFixed(10) + '</td></tr>'
				+ ' <tr><td>Periapsis</td><td>' + unitConvLength(o.semimajor_axis * (1 - o.eccentricity)) + '</td></tr>'
				+ ' <tr><td>Apoapsis</td><td>' + unitConvLength(o.semimajor_axis * (1 + o.eccentricity)) + '</td></tr>'
				+ ' <tr><td>head</td><td>' + headingApoapsis.toFixed(5) + '</td></tr>'
	//							+ ' omega=' + this.angularVelocity.x.toFixed(10) + ',' + '<br>' + this.angularVelocity.y.toFixed(10) + ',' + '<br>' + this.angularVelocity.z.toFixed(10)
				+'</table>'
			);
		},
		scene,
		select_obj
	);

	var irotate = AxisAngleQuaternion(-1, 0, 0, Math.PI / 2);
	// offset sun position
	light.position.copy(sun.model.position);

	grids.visible = settings.grid_enable;

//				camera.up.copy(new THREE.Vector3(0,0,1)); // This did't work with OrbitControls
	cameraControls.update();

	var oldPosition = camera.position.clone();
	var oldQuaternion = camera.quaternion.clone();
	if(settings.sync_rotate && select_obj){
		camera.quaternion.copy(
			select_obj.quaternion.clone()
			.multiply(AxisAngleQuaternion(0, 1, 0, -1*Math.PI / 2)));
		camera.position.copy(new THREE.Vector3(0, 0.2, 1).normalize().multiplyScalar(camera.position.length()).applyQuaternion(camera.quaternion));
	}
	var position = camera.position.clone();
	camera.position.set(0,0,0);
	renderer.render( background, camera);
	camera.position.copy(position);
	renderer.render( scene, camera );

	if(navballMesh && select_obj && select_obj.controllable){
		// First, calculate the quaternion for rotating the system so that
		// X axis points north, Y axis points east and Z axis points zenith.
		var north = new THREE.Vector3(0, 0, 1).applyQuaternion(select_obj.parent.quaternion);
		var tangent = north.cross(select_obj.position).normalize();
		var qball = new THREE.Quaternion();
		var mat = new THREE.Matrix4();
		var normal = select_obj.position.clone().normalize().negate();
		mat.makeBasis(tangent.clone().cross(normal), tangent, normal);
		qball.setFromRotationMatrix (mat);

		navballMesh.quaternion.copy(
			AxisAngleQuaternion(0, 1, 0, -1*Math.PI / 2)
			.multiply(AxisAngleQuaternion(0, 0, 1, Math.PI))
			.multiply(select_obj.quaternion.clone().conjugate())
			.multiply(qball)
			.multiply(AxisAngleQuaternion(1, 0, 0, Math.PI / 2))
			);
		navballMesh.position.y = -window.innerHeight / 2 + navballRadius;
		var grade;
		var factor;
		if(new THREE.Vector3(1, 0, 0).applyQuaternion(select_obj.quaternion).dot(select_obj.velocity) < 0){
			grade = retrograde;
			prograde.visible = false;
			factor = -1.;
		}
		else{
			grade = prograde;
			retrograde.visible = false;
			factor = 1.;
		}
		grade.visible = true;
		grade.position.y = -window.innerHeight / 2 + navballRadius + factor * new THREE.Vector3(0, 1, 0).applyQuaternion(select_obj.quaternion).dot(select_obj.velocity) / select_obj.velocity.length() * navballRadius;
		grade.position.x = factor * new THREE.Vector3(0, 0, 1).applyQuaternion(select_obj.quaternion).dot(select_obj.velocity) / select_obj.velocity.length() * navballRadius;
		camera.position.set(0,0,0);
		camera.quaternion.set(1,0,0,0);
		renderer.render( overlay, overlayCamera);
	}

	// Restore the original state because cameraControls expect these variables unchanged
	camera.quaternion.copy(oldQuaternion);
	camera.position.copy(oldPosition);

	if(select_obj && select_obj.parent){
		altitudeControl.setText(select_obj.position.length() * AU - select_obj.parent.radius);
	}
	else
		altitudeControl.setText(0);
}

function onKeyDown( event ) {
	var char = String.fromCharCode(event.which || event.keyCode).toLowerCase();

	switch ( char ) {

		case 'i':
			if(select_obj === null)
				select_obj = sun.children[0];
			else{
				// Some objects do not have an orbit
				if(select_obj.orbit)
					select_obj.orbit.material = select_obj.orbitMaterial;
				var objs = select_obj.children;
				if(0 < objs.length){
					select_obj = objs[0];
				}
				else{
					var selected = false;
					var prev = select_obj;
					for(var parent = select_obj.parent; parent; parent = parent.parent){
						objs = parent.children;
						for(var i = 0; i < objs.length; i++){
							var o = objs[i];
							if(o === prev && i + 1 < objs.length){
								select_obj = objs[i+1];
								selected = true;
								break;
							}
						}
						if(selected)
							break;
						prev = parent;
					}
					if(!parent)
						select_obj = sun;
				}
			}
			if(select_obj.orbit)
				select_obj.orbit.material = selectedOrbitMaterial;
			break;

		case 'c':
			center_select = !center_select;
			break;

		case 'n': // toggle NLIPS
			settings.nlips_enable = !settings.nlips_enable;
			break;

		case 'g':
			settings.grid_enable = !settings.grid_enable;
			break;

		case 'h':
			settings.sync_rotate = !settings.sync_rotate;
			break;

		case 'k':
			settings.units_km = !settings.units_km;
			break;
	}

	if(select_obj && select_obj.controllable) switch( char ){
		case 'w': // prograde
			buttons.up = true;
//						prograde = true;
			break;
		case 's': // retrograde
			buttons.down = true;
//						retrograde = true;
			break;
		case 'q': // normal
			buttons.counterclockwise = true;
//						normal = true;
			break;
		case 'e': // normal negative
			buttons.clockwise = true;
//						antinormal = true;
			break;
		case 'a': // orbit plane normal
			buttons.left = true;
//						incline = true;
			break;
		case 'd': // orbit plane normal negative
			buttons.right = true;
//						antiincline = true;
			break;
		case 'z':
			throttleControl.setThrottle(1);
			break;
		case 'x':
			throttleControl.setThrottle(0);
			break;
	}

	// Annoying browser incompatibilities
	var code = event.which || event.keyCode;
	// Also support numpad plus and minus
	if(code === 107 || code === 187 && event.shiftKey)
		timescaleControl.increment();
	if(code === 109 || code === 189)
		timescaleControl.decrement();
	if(code === 16)
		accelerate = true;
	if(code === 17)
		decelerate = true;
}

function onKeyUp( event ) {
	switch ( String.fromCharCode(event.which || event.keyCode).toLowerCase() ) {
		case 'w': // prograde
			buttons.up = false;
//						prograde = false;
			break;
		case 's':
			buttons.down = false;
//						retrograde = false;
			break;
		case 'q': // prograde
			buttons.counterclockwise = false;
//						normal = false;
			break;
		case 'e':
			buttons.clockwise = false;
//						antinormal = false;
			break;
		case 'a': // orbit plane normal
			buttons.left = false;
//						incline = false;
			break;
		case 'd': // orbit plane normal negative
			buttons.right = false;
//						antiincline = false;
			break;
	}
	// Annoying browser incompatibilities
	var code = event.which || event.keyCode;
	if(code === 16)
		accelerate = false;
	if(code === 17)
		decelerate = false;
}

init();
animate();
})()
