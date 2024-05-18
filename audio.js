import {
	AmplitudeEnvelope,
	AutoPanner,
	Channel,
	Distortion,
	FeedbackDelay,
	Filter,
	Limiter,
	Noise,
	Oscillator,
	Reverb,
	getDestination,
	getTransport,
} from "tone";

// master bus
const masterEnvelope = new AmplitudeEnvelope({ attack: 6, sustain: 1 });
const master = new Channel({ channelCount: 2, volume: -3 }).chain(
	masterEnvelope,
	new FeedbackDelay({ delayTime: "4n", feedback: 0.5 }),
	new Filter({
		frequency: 220,
		gain: 15,
		Q: 3,
		type: "lowshelf",
		rolloff: -24,
	}),
	new Distortion({ wet: 0.25 }),
	new Filter({ frequency: 4000, type: "lowpass" }),
	new Reverb({ wet: 0.5 }),
	new Limiter({ threshold: -0.1 }),
	getDestination(),
);

// drone
new Noise({ type: "brown", volume: -15 }).connect(master).start();
for (const frequency of [55, 110, 111, 113, 119]) {
	new Oscillator({
		type: `sine${Math.max(Math.floor(Math.random() * 32), 0)}`,
		frequency: frequency,
		volume: -3,
	})
		.chain(
			new AutoPanner({
				frequency: frequency * Math.random() * 0.005,
				depth: 0.7,
			}).start(),
			master,
		)
		.start();
}
masterEnvelope.triggerAttack();

// transport
const transport = getTransport();
transport.set({ bpm: 140 });
transport.start();
