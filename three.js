import {
	BufferGeometry,
	CatmullRomCurve3,
	Color,
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
// - phone responsiveness a bit wonky on actual phones: rotating the phone makes the scene not adjust to the full new width
// - moving 3d noise for something
// - multiple neighbourhood cellular automata

// scene
let renderer, scene, camera, composer, tanFOV;
const ORIGINAL_WINDOW_HEIGHT = window.innerHeight;
const BACKGROUND_HUE = clampedRandom(0, 360);
const BACKGROUND_SATURATION = 100;
const BACKGROUND_LIGHTNESS = 55;
const COLOR_PROBABILITY = 5;

// postprocessing
const pp_AFTERIMAGE_DAMP = clampedRandom(0.93, 0.98);
const pp_FILM_NOISE = 0.3;

// line
const l_STEPS = 20;
const l_STEP_SIZE = (2 * Math.PI) / l_STEPS;
const l_STEP_JITTER = 0.35 / 2;
const l_SUBDIVISIONS = 30;
const l_STEP_WIDTH_RATIO = clampedRandom(2.67, 3.67);
const l_STEP_HEIGHT_RATIO = clampedRandom(1.33, 2.33);

// waves
const w_NUM_LINES = Math.floor(
	window.innerWidth >= window.innerHeight
		? window.innerWidth / 60
		: window.innerHeight / 30,
);
const w_ROTATION = clampedRandom(-0.2, 0.3);
const w_GAP = clampedRandom(3, 4);
const w_DEPTH = 0.5;
const w_SPEED = clampedRandom(1.67, 3) * 10;

// fade in
let fi_accumulator = 0,
	fi_step = 0,
	fi_delta = 0,
	fi_prevousTime = 0,
	fi_fadeInDone = false;
const fi_SATURATION =
	Math.random() < COLOR_PROBABILITY / 100 ? BACKGROUND_SATURATION : 0;
const fi_STEP = (100 - BACKGROUND_LIGHTNESS) / 100;
const fi_DURATION = 1667;
const fi_RATE = fi_DURATION / 100;

// scene start
init();

const title = document.getElementById("title");
title.className = "fade-in";
title.style.opacity = "100%";

fi_prevousTime = Date.now();
animate();

function init() {
	scene = new Scene();
	scene.background = new Color(0xffffff);

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

	const baseMesh = createLineMesh();
	const group = new Group();
	for (let i = 0; i < w_NUM_LINES; i++) {
		const mesh = baseMesh.clone();
		mesh.geometry = baseMesh.geometry.clone();
		mesh.geometry.rotateZ((i / w_NUM_LINES) * Math.PI * w_ROTATION);
		mesh.geometry.scale(i / w_GAP, i / w_GAP, i / w_GAP);
		mesh.index = i;
		group.add(mesh);
	}
	scene.add(group);

	setupPostProcessing();
}

function animate() {
	requestAnimationFrame(animate);
	const time = Date.now();

	// fade in animation
	if (!fi_fadeInDone) {
		scene.background.setStyle(
			`hsl(${BACKGROUND_HUE}, ${fi_SATURATION}%, ${100 - (fi_step * (100 - BACKGROUND_LIGHTNESS)) / 100}%)`,
		);
		fi_step += fi_STEP;

		fi_accumulator = fi_RATE;
		fi_delta = time - fi_prevousTime;
		while (fi_accumulator >= fi_delta) {
			fi_accumulator--;
		}
		fi_fadeInDone = fi_step > 100 - BACKGROUND_LIGHTNESS;
	}

	scene.traverse(function(object) {
		if (object.isLine) {
			object.position.z =
				Math.sin(
					((object.index % w_NUM_LINES) * Math.PI) / w_SPEED + time * 0.001,
				) * w_DEPTH;
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

function createLineMesh() {
	const vertices = [];
	for (let i = 0; i < l_STEPS; i++) {
		vertices.push(
			new Vector3(
				Math.sin(i * l_STEP_SIZE) * l_STEP_WIDTH_RATIO +
				clampedRandom(-l_STEP_JITTER, l_STEP_JITTER),
				Math.cos(i * l_STEP_SIZE) * l_STEP_HEIGHT_RATIO +
				clampedRandom(-l_STEP_JITTER, l_STEP_JITTER),
				0,
			),
		);
	}

	const spline = new CatmullRomCurve3(vertices, true, "catmullrom");
	const samples = spline.getPoints(vertices.length * l_SUBDIVISIONS);

	const geometry = new BufferGeometry().setFromPoints(samples);
	geometry.center();
	const material = new LineBasicMaterial({ color: 0xffffff });

	const mesh = new Line(geometry, material);
	mesh.computeLineDistances();

	return mesh;
}

function setupPostProcessing() {
	composer = new EffectComposer(renderer);

	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	const afterimagePass = new AfterimagePass(pp_AFTERIMAGE_DAMP);
	composer.addPass(afterimagePass);

	const bloomPass = new UnrealBloomPass(
		new Vector2(window.innerWidth, window.innerHeight),
		0.3,
		0.1,
		1.0,
	);
	composer.addPass(bloomPass);

	const bokehPass = new BokehPass(scene, camera, {
		focus: 0.1,
		aperture: 0.05,
		maxblur: 0.005,
	});
	composer.addPass(bokehPass);

	const filmPass = new FilmPass(pp_FILM_NOISE);
	composer.addPass(filmPass);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_number_between_two_values
function clampedRandom(min, max) {
	let sign = 1;
	if (min < 0) {
		min = max + min;
		sign = Math.random() < 0.5 ? 1 : -1;
	}
	return sign * (Math.random() * (max - min) + min);
}
