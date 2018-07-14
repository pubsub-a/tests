import { ImplementationFactory } from "@dynalon/pubsub-a-interfaces";
import { Message, TOPICS } from "@dynalon/pubsub-a-server-node/dist/common";
import "chai";
import { expect } from "chai";
import * as socketio from "socket.io-client";
const URL = require("url").URL;

// these are not strictly pubsub-a tests, but put them here anyways in order to avoid a separate project
export const executeSocketIOTests = (factory: ImplementationFactory) => {

    if (factory.name !== "PubSubNodeClient")
        return

    const defaultOptions = {
        query: {},
        reconnection: false,
        timeout: 10000,
        // transports: ["websocket"],
        // transports: ["polling", "websocket"],
        // whether socketio should try to upgrade from long polling to websockets
        upgrade: true,
        // forceNew: true,

    };

    const url = process.env["PUBSUB_SERVER_URL"]  || "http://localhost:9800";

    describe("socket.io Tests", () => {

        it("performs a basic connect test and receives the configuration", done => {

            const socket = socketio(url, defaultOptions)

            socket.on("CONFIGURATION", () => {
                socket.close();
                socket.disconnect();
                done();
            })
        })

        it("should not kill the server when sending empty topics in a message", (done) => {
            const socket = socketio(url, defaultOptions);

            const message: Message = {
                channel: "",
                topic: "",
                payload: undefined
            }
            socket.emit(TOPICS.PUBLISH, message)
            setTimeout(() => {
                done()
            }, 100)
        })

        it("should not kill the server when publishing garbage", done => {
            const socket = socketio(url, defaultOptions);

            const message = { channel: { foo: "bar" }, topic: { bla: "blubb" }, payload: [new ArrayBuffer(5)] }
            socket.emit(TOPICS.PUBLISH, message);
            socket.emit(TOPICS.SUBSCRIBE, message);
            socket.emit(TOPICS.UNSUBSCRIBE, message);
            socket.emit(TOPICS.DISCONNECT_REASON, message);
            socket.emit(TOPICS.RECEIVE, message);
            socket.emit(TOPICS.SUBSCRIBE_DISCONNECT, message);
            socket.emit(TOPICS.UNSUBSCRIBE_DISCONNECT, message);
            socket.emit(TOPICS.CLIENT_DISCONNECTED, message);
            socket.emit(TOPICS.CONFIGURATION, message);

            setTimeout(() => {
                socket.disconnect();
                done()
            }, 100)

        })

        it(`should return a valid url in configuration - using ${url} for connect`, function(done) {
            // URL is not available in browser
            if (typeof window !== 'undefined')
                this.skip();

            const socket = socketio(url, defaultOptions);
            socket.on(TOPICS.CONFIGURATION, msg => {
                expect(msg.publicUrl).to.be.a("string");
                expect(msg.publicUrl).to.have.length.greaterThan(0)

                const returnedUrl = new URL(msg.publicUrl);
                const connectUrl = new URL(url);
                expect(returnedUrl.origin).to.equal(connectUrl.origin)

                socket.disconnect();
                done();
            })

        })
    })
}