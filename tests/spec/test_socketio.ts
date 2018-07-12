import { ImplementationFactory } from "@dynalon/pubsub-a-interfaces";
import * as socketio from "socket.io-client";

// these are not strictly pubsub-a tests, but put them here anyways in order to avoid a separate project
export const executeSocketIOTests = (factory: ImplementationFactory) => {
    if (factory.name !== "PubSubNodeClient")
        return

    describe("socket.io Tests", () => {

        it("performs a basic connect test and receives the configuration", done => {
            const start = new Date().getTime();
            const url = "http://localhost:9800";

            const query: any = {};

            const socket = socketio(url, {
                query,
                reconnection: false,
                timeout: 10000,
                // transports: ["websocket"],
                // transports: ["polling", "websocket"],
                // whether socketio should try to upgrade from long polling to websockets
                upgrade: true,
                // forceNew: true,

            });

            socket.on("CONFIGURATION", () => {
                socket.close();
                socket.disconnect();
                done();
            })
        })
    })
}