var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
var mouseX = 0;
var mouseY = 0;
var SEPARATION = 150, AMOUNTX = 4, AMOUNTY = 4, AMOUNTZ = 4;
var container, camera, scene, renderer, context;
// var stats;
var particle, particles, particleGroup;
var PI2 = Math.PI * 2;
var liveSource, analyser, javascriptNode;
var buflen = 1024;
var buf = new Uint8Array( buflen );
var MINVAL = 134; // 128 == zero. MINVAL is the "minimum detected signal" level.
var mode = 0, time = 0, duration = 0;
try {
	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	context = new AudioContext();
} catch(e) {
	alert('Web Audio API is not supported in this browser');
}
alert(
	"1) Mute your device's audio to avoid feedback." + "\n\n" +
	"2) When prompted, give one-time access to your audio input." + "\n\n" +
	"3) Click & drag to change the virtual camera's perspective." + "\n\n" +
	"4) Use the mousewheel or trackpad to zoom in and out." + "\n\n" +
	"5) Press any key to switch between modes (and experiment with horizontal mouse position)." + "\n\n" +
	"6) View in full screen on Google Chrome for the best effect." + "\n\n" +
	"7) Make some noise!"
);

init();
start();

function init() {
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 5000 );
	camera.position.z = 200;
	renderer = new THREE.CanvasRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );
	// // FRAME RATE STATS //
	// stats = new Stats();
	// stats.domElement.style.position = 'absolute';
	// stats.domElement.style.top = '0px';
	// container.appendChild( stats.domElement );
	controls = new THREE.OrbitControls(camera, renderer.domElement);
	scene = new THREE.Scene();          
	window.addEventListener('resize', onWindowResize, false);
	document.addEventListener('mousemove', onDocumentMouseMove, false);
	document.addEventListener('touchstart', onDocumentTouchStart, false);
	document.addEventListener('touchmove', onDocumentTouchMove, false);
}

function start() {
	navigator.webkitGetUserMedia = (
		navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia
	);
    navigator.webkitGetUserMedia({ audio: true }, function(stream) {
  		console.log("Connected to audio input.");
  		// SET UP AUDIO NODES //
  		var fftSize = 2048;
        analyser = context.createAnalyser(); // Set up live audio input analyser
        analyser.smoothingTimeConstant = 0.8; // A value from 0 to 1 where 0 represents no time averaging with the last analysis frame.
		analyser.fftSize = fftSize; // # of buckets (i.e. bincount) = fftSize / 2 (+ 1)
		liveSource = context.createMediaStreamSource(stream); // Set up live audio input stream
		liveSource.connect(analyser); //Connect source to analyser
		javascriptNode = context.createScriptProcessor(fftSize, 1, 1); //set up a javascript node   
        analyser.connect(javascriptNode); //connect analyser to javascriptNode (used for drawing at a specific interval)
        liveSource.connect(context.destination); //connect live audio to output (mute sound to avoid feedback)
		javascriptNode.connect(context.destination); //connect javascriptNode to destination; otherwise it isn't called
		animate(); //start render loop
    }, function(error) {
    	console.log(error);
    });
};

function map(val, dMin, dMax, rMin, rMax) {
    return (((rMax - rMin) / (dMax - dMin)) * (val - dMin)) + rMin;
}

function onWindowResize() {
	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function anyKeyDown() { //called by onkeydown from html page (i.e. when any key is pressed)
	if (mode == 0){
	    mode = 1; //Log History Mode
	} else {
	    mode = 0; //Instantaneous Mode
	}
};

function onDocumentMouseMove(event) {
	mouseX = event.clientX - windowHalfX;
	mouseY = event.clientY - windowHalfY;
	//duration for "Log History Mode" mapped to mouse movement on x-axis
	duration = Math.round(map(event.clientX, 0, window.innerWidth, 2, 90));
}

function onDocumentTouchStart(event) {
	if (event.touches.length === 1) {
		event.preventDefault();
		mouseX = event.touches[ 0 ].pageX - windowHalfX;
		mouseY = event.touches[ 0 ].pageY - windowHalfY;
		if (mode == 0) {
			mode = 1; //Log History Mode
		} else {
		    mode = 0; //Instantenous Mode
		}
		// duration for "Log History Mode" mapped to touch placement on x-axis
		duration = Math.round(map(event.touches[ 0 ].pageX, 0, window.innerWidth, 2, 90));
	}
}

function onDocumentTouchMove(event) {
	if (event.touches.length === 1) {
		event.preventDefault();
		mouseX = event.touches[ 0 ].pageX - windowHalfX;
		mouseY = event.touches[ 0 ].pageY - windowHalfY;
	}
	// duration for "Log History Mode" mapped to touch movement on x-axis
	for(var i = 0; i < event.touches.length; i++) {
		duration = Math.round(map(event.touches[ i ].pageX, 0, window.innerWidth, 2, 90));
	}
}

function animate() {
	requestAnimationFrame(animate);
	render();
	// stats.update();
}

function update(average) {
	particleGroup.rotation.z += (average/10);
	particleGroup.rotation.y += (average/10);
	controls.update();
}

function render() {
	time += 1;
	time = (time == 1331 ? 11 : time);
	// FFTdata bincount is fftsize / 2
	// frequency bands are split equally
	// each element "i" of the array corresponds to: i * samplerate/fftSize
	// in this case: samplerate = 44100, fftSize = 512
	// therefore: FFTdata[1] = energy at 86 Hz, FFTdata[2] = energy at 172 Hz, etc.
    var FFTdata =  new Uint8Array(analyser.frequencyBinCount);
    // var FFTdata =  new Float32Array(analyser.frequencyBinCount); // alternatively
    analyser.getByteFrequencyData(FFTdata);
    var average = getAverageVolume(FFTdata);
    var colour = getColour( updatePitch(), average );

	switch(mode) {
		case 0:
			scene = new THREE.Scene(); // Instantaneous Mode
		break;

		case 1:
			if(time % duration == 0) { scene = new THREE.Scene(); } // Log History Mode
		break;
	}

	particles = new Array();
	particleGroup = new THREE.Object3D();

	var	program = function ( ctx ) {
		ctx.beginPath();
		ctx.arc( 0, 0, 1, 0, PI2, true );
		ctx.fill();
	}

	var i = 0; 

	for ( var ix = 0; ix < AMOUNTX; ix ++ ) {
		for ( var iy = 0; iy < AMOUNTY; iy ++ ) {
			for ( var iz = 0; iz < AMOUNTZ; iz ++ ) {

				var canvasMaterial = new THREE.ParticleCanvasMaterial( { color: colour, opacity: average/200, program: program });
				particle = particles[i++] = new THREE.Particle( canvasMaterial );

				particle.position.x = ix * SEPARATION - ( ( AMOUNTX * SEPARATION ) / 2 );
				particle.position.z = iz * SEPARATION - ( ( AMOUNTZ * SEPARATION ) / 2 );
				particle.position.y = iy * SEPARATION - ( ( AMOUNTY * SEPARATION ) / 2 );

				particle.position.x += Math.sin(average) * average;
				particle.position.z += Math.cos(average) * average;
				particle.position.y += Math.sin(average) * average;
				
				particle.scale.x = particle.scale.y = average * 0.8;
				particleGroup.add( particle );
				scene.add( particleGroup );

			}
		}
	}
	update(average);
	camera.lookAt( scene.position );
	renderer.render( scene, camera );
}

function getAverageVolume(FFTdata) {
	var values = 0;
	var average;
	var length = FFTdata.length;
	// get all the frequency amplitudes
	// start at FFTdata[1] (i.e. 86 Hz) to avoid "frequency zero" i.e. DC offset
	for (var i = 1; i < length; i++) {
	    values += FFTdata[i];
	}
	average = values / length;
	return average;
}

function updatePitch( time ) {
    var cycles = new Array;
    analyser.getByteTimeDomainData( buf );

    // find the first point
    var last_zero = findNextPositiveZeroCrossing( 0 );

    var n = 0;
    // keep finding points, adding cycle lengths to array
    while ( last_zero != -1) {
        var next_zero = findNextPositiveZeroCrossing( last_zero + 1 );
        if (next_zero > -1) {
            cycles.push( next_zero - last_zero );
        }
        last_zero = next_zero;
        n++;
        if (n > 1000) {
        	break;
        }
    }

    // 1?: average the array
    var num_cycles = cycles.length;
    var sum = 0;
    var pitch = 0;

    for (var i=0; i<num_cycles; i++) {
        sum += cycles[i];
    }

    if (num_cycles) {
        sum /= num_cycles;
        pitch = context.sampleRate/sum;
    }

	// confidence = num_cycles / num_possible_cycles = num_cycles / (context.sampleRate/)
    // var confidence = (num_cycles ? ((num_cycles/(pitch * buflen / context.sampleRate)) * 100) : 0);

    // console.log(
	   //  "Cycles: " + num_cycles +
	   //  " - average length: " + sum +
	   //  " - pitch: " + pitch + "Hz " +
	   //  " - note: " + noteFromPitch( pitch ) +
	   //  " - confidence: " + confidence + "% "
    // );

    // if (num_cycles > 0) {
    //     var note = noteFromPitch( pitch );
    //     // var noteLetter = noteStrings[note%12];
    //     // console.log(pitch);
    // }

    return [pitch];
}

// var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getColour(pitch, average) {
	var h = pitch/2200;  
	var s = map(average, 0, 180.0, 0.3, 1.0);
	var l = map(average, 0, 180.0, 0.3, 1.0);
    var colour = new THREE.Color().setHSL(h,s,l);
    return colour;
};

function noteFromPitch( frequency ) {
    var noteNum = 12 * (Math.log( frequency/440 ) / Math.log(2));
    return Math.round( noteNum ) + 69;
}

function findNextPositiveZeroCrossing( start ) {
    var i = Math.ceil( start );
    var last_zero = -1;
    // advance until we're zero or negative
    while (i<buflen && (buf[i] > 128 ) )
            i++;
    if (i>=buflen)
            return -1;

    // advance until we're above MINVAL, keeping track of last zero.
    while (i<buflen && ((t=buf[i]) < MINVAL )) {
        if (t >= 128) {
            if (last_zero == -1) {
            	last_zero = i;
            }
        } else {
        	last_zero = -1;
        }
        i++;
    }

    // We may have jumped over MINVAL in one sample.
    if (last_zero == -1) {
        last_zero = i;
    }

    // We didn't find any more positive zero crossings
    if (i==buflen) {
    	return -1;
    }

    // The first sample might be a zero. If so, return it.
    if (last_zero == 0) {
    	return 0;
    }

    // Otherwise, the zero might be between two values, so we need to scale it.
    var t = ( 128 - buf[last_zero-1] ) / (buf[last_zero] - buf[last_zero-1]);
    return last_zero+t;
}
