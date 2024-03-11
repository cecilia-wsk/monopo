import * as THREE from "three";
import fragment from "./shader/fragment.glsl";
import vertex from "./shader/vertex.glsl";
import fragmentFresnel from "./shader/fragmentFresnel.glsl";
import vertexFresnel from "./shader/vertexFresnel.glsl";
import * as dat from "dat.gui";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { CustomShader } from './customShader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import model from '/assets/crab_draco.glb';

const THREE_PATH = 'https://unpkg.com/three@0.161.0';

export default class Sketch {
	
	constructor(options) {
		this.scene = new THREE.Scene();

		this.clock = new THREE.Clock();

		this.width = window.innerWidth;
		this.height = window.innerHeight;

		this.loader = new GLTFLoader();
		this.dracoLoader = new DRACOLoader();

		this.dracoLoader.setDecoderPath( `${THREE_PATH}/examples/jsm/libs/draco/` );
		this.loader.setDRACOLoader(this.dracoLoader);

		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});

		this.renderer.setSize( this.width , this.height )
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		this.renderer.setClearColor(0xeeeeee, 1);
		this.renderer.physicallyCorrectLights = true;
		this.renderer.outputEncoding = THREE.sRGBEncoding; 

		this.container = document.getElementById("webgl");
		this.container.appendChild(this.renderer.domElement);

		this.speed = 0;
		this.targetSpeed = 0;
		this.mouse = new THREE.Vector2();
		this.followMouse = new THREE.Vector2();
		this.prevMouse = new THREE.Vector2();

		this.paused = false;

		this.loader.load( model, (obj) => {
			this.model = obj.scene.children[0];
			this.model.geometry.scale(0.1,0.1,0.1);

			this.modelPos = this.model.geometry.attributes.position.array;
			this.modelNumber = this.modelPos.length/3;
			
			this.settings();
			this.addCamera();
			this.initPostProcessing();
			this.addObjects();
			this.addControls();
			this.createMesh();
			this.resize();
			this.render();
		})

		// this.settings();
		// this.addCamera();
		// this.initPostProcessing();
		// this.addObjects();
		// this.addControls();
		// this.createMesh();
		// this.resize();
		// this.render();

		window.addEventListener('mousemove', (event) => {
			this.mouseMouve(event);
		});

		window.addEventListener('resize', (event) => {
			this.resize(event);
		});

	}

	settings = () => {
		this.settings = {
			mRefractionRatio: 1.02,
			mFresnelBias: 0.1,
			mFresnelScale: 4.,
			mFresnelPower: 2.
		};
		// this.gui = new dat.GUI();
		// this.gui.add(this.settings, "mRefractionRatio", 0, 10., 0.1 ).onChange( () => {
		// 	this.materialCenter.uniforms.uRefractionRatio.value = this.settings.mRefractionRatio;
		// });
		// this.gui.add(this.settings, "mFresnelBias", 0, 10., 0.01 ).onChange( () => {
		// 	this.materialCenter.uniforms.uFresnelBias.value = this.settings.mFresnelBias;
		// });
		// this.gui.add(this.settings, "mFresnelScale", 0, 10., 0.1 ).onChange( () => {
		// 	this.materialCenter.uniforms.uFresnelScale.value = this.settings.mFresnelScale;
		// });
		// this.gui.add(this.settings, "mFresnelPower", 0, 10., 0.1 ).onChange( () => {
		// 	this.materialCenter.uniforms.uFresnelPower.value = this.settings.mFresnelPower;
		// });
	}

	mouseMouve = (event) => {
		this.mouse.x = ( event.clientX / this.width ) ;
		this.mouse.y = 1. - ( event.clientY/ this.height );
	}

	resize = () => {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
    	// Update camera
		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();
		// Update renderer
		this.renderer.setSize(this.width, this.height);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		// this.keepImageAspectRatio();
	}

	keepImageAspectRatio = (object) => {
		// image cover
		let imageAspect = object.iHeight / object.iWidth;
		let a1;
		let a2;

		if (object.height / object.width > imageAspect) {
			a1 = (object.width / object.height) * imageAspect;
			a2 = 1;
		} else {
			a1 = 1;
			a2 = object.height / object.width / imageAspect;
		}
		// update material
		this.material.uniforms.uResolution.value.x = object.width;
		this.material.uniforms.uResolution.value.y = object.height;
		this.material.uniforms.uResolution.value.z = a1;
		this.material.uniforms.uResolution.value.w = a2;
	}

	addCamera = () => {
		this.camera = new THREE.PerspectiveCamera(
			75,
			this.width/this.height,
			0.01,
			100
		);

		this.camera.position.set(0, 0, 1.3);
		// this.camera.lookAt(0, 0, 0);
		this.scene.add(this.camera);
	}

	addControls = () => {
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		// this.controls.maxZoom = 1.1;
		this.controls.maxDistance = 1.5;
		this.controls.autoRotate = true;
		this.controls.autoRotateSpeed = 0.5;
	}

	addObjects = () => {
		this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(
			256, {
				format: THREE.RGBAFormat,
				generateMipmaps: true,
				minFilter: THREE.LinearMipMapLinearFilter,
				encoding: THREE.sRGBAEncoding
			}
		)
		this.cubeCamera = new THREE.CubeCamera( 0.1, 10, this.cubeRenderTarget);

		this.geometry = new THREE.SphereGeometry(1.5,32,32);
		this.material = new THREE.ShaderMaterial({
			extensions: {
				derivatives: "#extension GL_OES_standard_derivatives : enable"
			},
			uniforms: {
				uTime: { value: 0 },
				uMouse: { value: new THREE.Vector2(0,0) },
				uResolution: { value: new THREE.Vector4(this.width, this.height, 1, 1) },
			},
			// wireframe: true,
			antialias: true,
			side: THREE.DoubleSide,
			vertexShader: vertex,
			fragmentShader: fragment
		});

		// this.geometryCenter = new THREE.CapsuleGeometry( .2, .5, 20, 20 );
		this.geometryCenter = this.model.geometry;
		this.materialCenter = new THREE.ShaderMaterial({
			extensions: {
				derivatives: "#extension GL_OES_standard_derivatives : enable"
			},
			uniforms: {
				uTime: { value: 0 },
				tCube: { value: 0 },
			},
			//wireframe: true,
			antialias: true,
			side: THREE.DoubleSide,
			vertexShader: vertexFresnel,
			fragmentShader: fragmentFresnel
		});

	}

	createMesh = () => {
		// this.keepImageAspectRatio();
		this.mesh = new THREE.Mesh(this.geometry, this.material);
		this.scene.add(this.mesh);
		this.objectCenter = new THREE.Mesh(this.geometryCenter, this.materialCenter);
		this.scene.add(this.objectCenter);
	}

	initPostProcessing = () => {
		this.composer = new EffectComposer(this.renderer);
		this.renderPass = new RenderPass(this.scene, this.camera);
		this.composer.addPass(this.renderPass);

		const customPass = new ShaderPass(CustomShader);
		customPass.uniforms['scale'].value = 10;
		this.composer.addPass(customPass);
	}

	stop = () => {
		this.paused = true;
	}

	play = () => {
		this.paused = false;
		this.render();
	}

	getSpeed = () => {
		this.speed = Math.sqrt( (this.prevMouse.x- this.mouse.x)**2 + (this.prevMouse.y- this.mouse.y)**2 );

		this.targetSpeed -= 0.1*(this.targetSpeed - this.speed);
		this.followMouse.x -= 0.1*(this.followMouse.x - this.mouse.x);
		this.followMouse.y -= 0.1*(this.followMouse.y - this.mouse.y);

		this.prevMouse.x = this.mouse.x;
		this.prevMouse.y = this.mouse.y;
	}

	render = () => {

		this.elapsedTime = this.clock.getElapsedTime();
		
		this.controls.update();
		this.getSpeed();
		
		this.objectCenter.visible = false;
		this.cubeCamera.update(this.renderer, this.scene);
		this.materialCenter.uniforms.tCube.value = this.cubeRenderTarget.texture;
		this.objectCenter.visible = true;

		this.material.uniforms.uTime.value = this.elapsedTime;
		this.material.uniforms.uMouse.value = this.followMouse;
		this.targetSpeed *= 0.999;
		
		// this.renderer.render(this.scene, this.camera);

		if(this.composer) this.composer.render()

    	// Call tick again on the next frame
    	window.requestAnimationFrame( this.render )
	}
}

new Sketch();