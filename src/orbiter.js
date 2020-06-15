import * as THREE from 'three/build/three.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import "./main.css";

import { CelestialBody, addPlanet, AxisAngleQuaternion } from './CelestialBody';
import { Settings, SettingsControl } from './SettingsControl';
import { TimeScaleControl } from './TimeScaleControl';
import { ThrottleControl } from './ThrottleControl';
import { navballRadius, RotationControl, RotationButtons } from './RotationControl';
import { OrbitalElementsControl } from './OrbitalElementsControl';
import { zerofill, StatsControl } from './StatsControl';
import { MessageControl } from './MessageControl';
import { ScenarioSelectorControl } from './ScenarioSelectorControl';
import { SaveControl } from './SaveControl';
import { LoadControl } from './LoadControl';
import Overlay from './Overlay';
import Universe from './Universe';

import backgroundUrl from './images/hipparcoscyl1.jpg';



;(function(){
'use strict'
var container, stats;
var camera, scene, renderer;
var background;
var overlay;
var timescaleControl;
var throttleControl;
var speedControl;
var orbitalElementsControl;
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

var buttons = new RotationButtons();
var accelerate = false;
var decelerate = false;

var universe;

var selectedOrbitMaterial;

var AU = 149597871; // Astronomical unit in kilometers
var timescale = 1e0; // This is not a constant; it can be changed by the user

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

	overlay = new Overlay();

	scene = new THREE.Scene();

	function AddPlanet(semimajor_axis, eccentricity, inclination, ascending_node, argument_of_perihelion, color, GM, parent, texture, radius, params, name, orbitGeometry){
		return addPlanet(semimajor_axis, eccentricity, inclination, ascending_node, argument_of_perihelion, color, GM, parent, texture, radius, params, name,
			scene, viewScale, overlay.overlay, orbitGeometry, center_select, settings, camera, windowHalfX, windowHalfY);
	}

	var orbitMaterial = new THREE.LineBasicMaterial({color: 0x3f3f7f});
	CelestialBody.prototype.orbitMaterial = orbitMaterial; // Default orbit material
	selectedOrbitMaterial = new THREE.LineBasicMaterial({color: 0xff7fff});

	universe = new Universe(scene, AddPlanet, center_select, viewScale, settings, camera);

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

	select_obj = universe.rocket;
	center_select = true;
	camera.position.set(0.005, 0.003, 0.005);

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

	throttleControl = new ThrottleControl(windowHalfX, (pos) => {
		if(1 < timescale && 0 < pos){
			messageControl.setText('You cannot accelerate while timewarping');
			return false;
		}
		if(!select_obj || !select_obj.controllable){
			messageControl.setText('You need to select a controllable object to set throttle');
			return false;
		}
		return true;
	}, () => select_obj);
	container.appendChild( throttleControl.domElement );

	var rotationControl = new RotationControl(buttons);
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

	orbitalElementsControl = new OrbitalElementsControl();
	container.appendChild( orbitalElementsControl.domElement );

	settingsControl = new SettingsControl(settings);
	statsControl = new StatsControl(settingsControl, () => select_obj);
	container.appendChild( statsControl.domElement );
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

	messageControl = new MessageControl();
	container.appendChild( messageControl.domElement );

	scenarioSelectorControl = new ScenarioSelectorControl(function(){return select_obj;},
		function(throttle){ throttleControl.setThrottle(throttle); },
		function(){
			simTime = new Date();
			realTime = simTime;
			startTime = simTime;
		},
		function(msg){ messageControl.setText(msg); },
		function(){
			[saveControl, loadControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
		}
	);
	container.appendChild( scenarioSelectorControl.domElement );

	function serializeState(){
		return {
			simTime: simTime,
			startTime: startTime,
			bodies: universe.sun.serializeTree(),
		};
	}

	saveControl = new SaveControl(
		serializeState,
		function(msg){ messageControl.setText(msg); },
		function(){
			[scenarioSelectorControl, loadControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
		}
	);
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
		if(select_obj)
			throttleControl.setThrottle(select_obj.throttle);
	}

	loadControl = new LoadControl(
		loadState,
		function(msg){ messageControl.setText(msg); },
		function(){
			[scenarioSelectorControl, saveControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
		}
	);
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
	statsControl.setText(simTime, startTime);
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

		universe.simulateBody(deltaTime, div, timescale, buttons, select_obj);
	}

	universe.update(center_select, viewScale, settings.nlips_enable, camera, windowHalfX, windowHalfY,
		settings.units_km,
		function(o, headingApoapsis){
			orbitalElementsControl.setText(o, headingApoapsis, settings.units_km);
		},
		scene,
		select_obj
	);

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

	if(select_obj && select_obj.controllable){
		overlay.updateRotation(select_obj);
		camera.position.set(0,0,0);
		camera.quaternion.set(1,0,0,0);
		overlay.render(renderer);
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
