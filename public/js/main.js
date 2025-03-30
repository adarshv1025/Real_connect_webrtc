const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const allusersHtml = document.getElementById("allusers");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("end-call-btn");
const socket = io(window.location.origin, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});
let localStream;
let caller = [];

// Single Method for peer connection
const PeerConnection = (function(){
    let peerConnection;

    const createPeerConnection = () => {
        const config = {
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com:19302'
                }
            ]
        };
        peerConnection = new RTCPeerConnection(config);

        // add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        })
        // listen to remote stream and add to peer connection
        peerConnection.ontrack = function(event) {
            remoteVideo.srcObject = event.streams[0];
        }
        // listen for ice candidate
        peerConnection.onicecandidate = function(event) {
            if(event.candidate) {
                socket.emit("icecandidate", event.candidate);
            }
        }

        return peerConnection;
    }

    return {
        getInstance: () => {
            if(!peerConnection){
                peerConnection = createPeerConnection();
            }
            return peerConnection;
        }
    }
})();

// handle browser events
createUserBtn.addEventListener("click", (e) => {
    if(username.value !== "") {
        const usernameContainer = document.querySelector(".username-input");
        socket.emit("join-user", username.value);
        usernameContainer.style.display = 'none';
    }
});
endCallBtn.addEventListener("click", (e) => {
    socket.emit("call-ended", caller)
})

// handle socket events
socket.on("joined", allusers => {
    console.log({ allusers });
    const createUsersHtml = () => {
        allusersHtml.innerHTML = "";

        for(const user in allusers) {
            const li = document.createElement("li");
            li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

            if(user !== username.value) {
                const button = document.createElement("button");
                button.classList.add("call-btn");
                button.addEventListener("click", (e) => {
                    startCall(user);
                });
                const img = document.createElement("img");
                img.setAttribute("src", "/images/phone.png");
                img.setAttribute("width", 20);

                button.appendChild(img);

                li.appendChild(button);
            }

            allusersHtml.appendChild(li);
        }
    }

    createUsersHtml();

})
socket.on("offer", async ({from, to, offer}) => {
    const pc = PeerConnection.getInstance();
    // set remote description
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", {from, to, answer: pc.localDescription});
    caller = [from, to];
});
socket.on("answer", async ({from, to, answer}) => {
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(answer);
    // show end call button
    endCallBtn.style.display = 'block';
    socket.emit("end-call", {from, to});
    caller = [from, to];
});
socket.on("icecandidate", async candidate => {
    console.log({ candidate });
    const pc = PeerConnection.getInstance();
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
});
socket.on("end-call", ({from, to}) => {
    endCallBtn.style.display = "block";
});
socket.on("call-ended", (caller) => {
    endCall();
})

socket.on('connect', () => {
    console.log('Connected to socket server');
    console.log('Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

// start call method
const startCall = async (user) => {
    console.log({ user })
    const pc = PeerConnection.getInstance();
    const offer = await pc.createOffer();
    console.log({ offer })
    await pc.setLocalDescription(offer);
    socket.emit("offer", {from: username.value, to: user, offer: pc.localDescription});
}

const endCall = () => {
    const pc = PeerConnection.getInstance();
    if(pc) {
        pc.close();
        endCallBtn.style.display = 'none';
    }
}

// initialize app
const startMyVideo = async () => {
    // Check for secure context
    if (!window.isSecureContext) {
        console.error('Insecure context: Camera access may be blocked');
        alert('Camera access requires a secure connection (HTTPS). Please use HTTPS or localhost.');
        return;
    }

    // Check for media devices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('Media devices not supported');
        alert('Your browser does not support camera access.');
        return;
    }

    try {
        const constraints = { 
            audio: true, 
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user' // Prefer front camera
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Additional checks
        if (!stream.getVideoTracks().length) {
            throw new Error('No video tracks available');
        }

        localStream = stream;
        localVideo.srcObject = stream;
        localVideo.onloadedmetadata = () => {
            localVideo.play();
        };

        console.log('Video stream successfully accessed');
    } catch(error) {
        console.error('Error accessing media devices:', error);
        
        // Detailed error handling
        switch(error.name) {
            case 'NotAllowedError':
                alert('Camera access was denied. Please check your browser permissions.');
                break;
            case 'NotFoundError':
                alert('No camera found. Please connect a camera and try again.');
                break;
            case 'OverconstrainedError':
                alert('Cannot find a camera that meets the specified constraints.');
                break;
            default:
                alert(`Camera access failed: ${error.message}. Please check your device and permissions.`);
        }
    }
};

startMyVideo();