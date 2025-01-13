import { OpenAIWebRTC } from "@werift/openai-webrtc";
import { MediaStreamTrack, RTCPeerConnection } from "werift";

const { OPENAI_API_KEY } = process.env;

export class Session {
  readonly pc = new RTCPeerConnection();
  readonly track = new MediaStreamTrack({ kind: "audio" });
  openai?: OpenAIWebRTC;

  static async init(...args: ConstructorParameters<typeof Session>) {
    const session = new Session(...args);
    await session.init();
    return session;
  }

  constructor(readonly id: string) {
    const transceiver = this.pc.addTransceiver(this.track, {
      direction: "sendrecv",
    });
    transceiver.onTrack.subscribe((track) => {
      track.onReceiveRtp.subscribe((rtp) => {
        rtp.header.marker = true;
        if (this.openai) {
          this.openai.writeRtp(rtp.serialize());
        }
      });
    });

    this.pc.onconnectionstatechange = () => {
      console.log("Connection state changed to", this.pc.connectionState);
    };
  }

  private async init() {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-realtime-preview-2024-12-17",
        modalities: ["audio", "text"],
        instructions: "日本語で話してください",
        voice: "verse",
      }),
    });
    const {
      client_secret: { value },
    } = await r.json();

    this.openai = await OpenAIWebRTC.init({
      token: value,
      onInboundTrack: (track) => {
        track.onReceiveRtp.subscribe((rtp) => {
          this.track.writeRtp(rtp as any);
        });
      },
    });
    this.openai.datachannel.onmessage = (e) => {
      console.log("Received message from OpenAI", e.data);
    };
  }

  async handleOffer(sdp: string) {
    await this.pc.setRemoteDescription({
      type: "offer",
      sdp,
    });

    await this.pc.setLocalDescription(await this.pc.createAnswer());
    return this.pc.localDescription!.sdp;
  }
}
