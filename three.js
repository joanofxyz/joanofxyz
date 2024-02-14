import {
	BufferGeometry,
	CatmullRomCurve3,
	Color,
	Fog,
	Group,
	Line,
	LineBasicMaterial,
	PerspectiveCamera,
	Scene,
	Vector2,
	Vector3,
	WebGLRenderer,
} from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

if (!WebGL.isWebGLAvailable()) {
	const warning = WebGL.getWebGLErrorMessage();
	console.log(warning);

	const dialog = document.getElementById("error-dialog");
	dialog.innerHTML = warning.innerHTML;
	dialog.showModal();

	throw new Error(warning);
}

// TODO:
// - use InstancedMesh
// - group postprocessing passes
// - phone responsiveness a bit wonky on actual phones

const ORIGINAL_WINDOW_HEIGHT = window.innerHeight;

const NUM_LINES = window.innerWidth / 50 + window.innerHeight / 30;
const LINE_ROTATION = clampedRandom(0.5, 0.2) * (Math.random() > 0.5 ? 1 : -1);
const LINE_GAP = Math.round(clampedRandom(3, 2));
const WAVE_DEPTH = 0.5;
const WAVE_SPEED =
	Math.round(Math.random() + Math.round(clampedRandom(1, 1))) * 10;

const LINE_SUBDIVISIONS = 9;
const LINE_STEPS = 30;
const STEP_SIZE = (2 * Math.PI) / LINE_STEPS;
const STEP_JITTER = 0.05;
const STEP_WIDTH_RATIO = clampedRandom(1, 2);
const STEP_HEIGHT_RATIO = clampedRandom(1, 1);

let renderer, scene, camera, composer, tanFOV;

init();

const title = document.getElementById("title");
title.className = "fade-in";
title.style.opacity = "100%";

animate();

function init() {
	scene = new Scene();
	scene.background = new Color(0x999999);
	scene.fog = new Fog(0xebebeb, 10, 1000);

	renderer = new WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	camera = new PerspectiveCamera(
		75,
		window.innerWidth / window.innerHeight,
		0.1,
		1000,
	);
	camera.position.set(-4, -7.5, 5.5);
	camera.rotation.set(0.8, -0.3, 0.3);
	scene.add(camera);
	tanFOV = Math.tan(((Math.PI / 180) * camera.fov) / 2);

	window.addEventListener("resize", handleResize);
	screen.orientation.addEventListener("change", handleResize);

	const baseMesh = createBaseLineMesh();
	const baseGeometry = baseMesh.geometry.clone();

	const group = new Group();
	for (let i = 1; i <= NUM_LINES; i++) {
		const mesh = baseMesh.clone();
		mesh.geometry = baseGeometry.clone();
		mesh.geometry.rotateZ((i / NUM_LINES) * Math.PI * LINE_ROTATION);
		mesh.geometry.scale(
			Math.sqrt(i * i) / LINE_GAP,
			Math.sqrt(i * i) / LINE_GAP,
			Math.sqrt(i * i) / LINE_GAP,
		);
		mesh.index = i;
		group.add(mesh);
	}
	scene.add(group);

	setupPostProcessing();
}

function animate() {
	requestAnimationFrame(animate);

	const time = Date.now() * 0.001;
	scene.traverse(function(object) {
		if (object.isLine) {
			object.position.z =
				Math.sin(((object.index % NUM_LINES) * Math.PI) / WAVE_SPEED + time) *
				WAVE_DEPTH;
		}
	});

	composer.render();
}

function handleResize() {
	camera.fov =
		(360 / Math.PI) *
		Math.atan(tanFOV * (window.innerHeight / ORIGINAL_WINDOW_HEIGHT));
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	composer.setSize(window.innerWidth, window.innerHeight);
}

function createBaseLineMesh() {
	const vertices = [];
	for (let i = 0; i <= LINE_STEPS; i++) {
		vertices.push(
			new Vector3(
				Math.sin(i * STEP_SIZE) * STEP_WIDTH_RATIO +
				clampedRandom(STEP_JITTER, 0),
				Math.cos(i * STEP_SIZE) * STEP_HEIGHT_RATIO +
				clampedRandom(STEP_JITTER, 0),
				0,
			),
		);
	}

	const spline = new CatmullRomCurve3(vertices, true);
	const samples = spline.getPoints(vertices.length * LINE_SUBDIVISIONS);

	const geometry = new BufferGeometry().setFromPoints(samples);
	geometry.center();

	const line = new Line(
		geometry,
		new LineBasicMaterial({ color: 0xffffff, fog: true }),
	);
	line.computeLineDistances();

	return line;
}

function setupPostProcessing() {
	composer = new EffectComposer(renderer);

	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	const afterimagePass = new AfterimagePass(0.91);
	composer.addPass(afterimagePass);

	const bloomPass = new UnrealBloomPass(
		new Vector2(window.innerWidth, window.innerHeight),
		0.3,
		0.4,
		3.0,
	);
	bloomPass.strength = 0.3;
	bloomPass.radius = 0.1;
	bloomPass.exposure = 0.1;
	composer.addPass(bloomPass);

	const bokehPass = new BokehPass(scene, camera, {
		focus: 0.1,
		aperture: 0.05,
		maxblur: 0.005,
	});
	composer.addPass(bokehPass);

	const filmPass = new FilmPass(0.35);
	composer.addPass(filmPass);
}

function clampedRandom(range, offset) {
	return Math.random() * range + offset;
}
