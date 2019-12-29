// import { ImplementationFactory, ObserverFunc, PubSub, SubscriptionToken } from "@pubsub-a/interfaces";
// import { getRandomInt } from "../test_helper";
// import * as ipterate from "ipterate";
// import { Client } from "@dynalon/pubsub-a-server-node";
// import { once } from "lodash";

// interface LoadTestOptions {
//     numClients: number
//     socketsPerSecond: number;
//     localAddress?: string;
// }

// export let defaultLoadTestOptions: LoadTestOptions = {
//     numClients: 10_000,
//     socketsPerSecond: 100
// }

// function getIpAddressList(range: string) {
//     if (range.indexOf("/") === -1) {
//         return [range];
//     }
//     const ips: string[] = [];
//     ipterate.range(range).iterate(ip => {
//         ips.push(ip);
//     });
//     return ips;
// }

// function defer(ms: number): Promise<void> {
//     return new Promise(resolve => {
//         setTimeout(resolve, ms);
//     })
// }

// export class ClientCluster {
//     public readonly options: LoadTestOptions;
//     public readonly clients: PubSub[];

//     constructor(private factory: ImplementationFactory, options: Partial<LoadTestOptions> = {}) {
//         this.options = { ...defaultLoadTestOptions, ...options } as LoadTestOptions;
//         this.clients = this.createClients();
//     }

//     connectClients(): Promise<PubSub[]> {
//         let connectedClients: Promise<PubSub>[] = [];

//         const clients = [...this.clients];

//         // since most systems will error (SOCKET_ERR) when creating too many sockets at once, we do it
//         // gracefully
//         let slice = clients.splice(0, this.options.socketsPerSecond);
//         let secondsIteration = 0;
//         let connectStart = new Date().getTime();
//         while (slice.length > 0) {
//             const promises = slice.map(client => this.connectClientDelayed(client, secondsIteration * 1_000))
//             const buf = secondsIteration;
//             Promise.all(promises).then(() => {
//                 console.info(`Connected ${this.options.socketsPerSecond * (buf + 1)} clients at ${new Date().getTime() - connectStart}`)
//             }).catch()
//             connectedClients = [...connectedClients, ...promises];
//             secondsIteration++;
//             slice = clients.splice(0, this.options.socketsPerSecond);
//         }

//         return Promise.all(connectedClients);
//     }

//     subscribeClients<T>(channelName: string, topic: string, observer: ObserverFunc<T>): Promise<SubscriptionToken[]> {
//         return Promise.all(this.clients.map(client => client.channel(channelName)))
//             .then(channels => Promise.all(channels.map(chan => chan.subscribe(topic, observer))))
//     }

//     publishClients<T>(channelName: string, topic: string, payload: T): Promise<any> {
//         return Promise.all(this.clients.map(client => client.channel(channelName)))
//             .then(channels => Promise.all(channels.map(chan => chan.publish(topic, payload))))
//     }

//     dispose(): Promise<any> {
//         return Promise.all(this.clients.map(client => {
//             if (!client.isStopped)
//                 return client.stop({ reason: "LOCAL_DISCONNECT" })
//             else
//                 return Promise.resolve()
//         }))
//     }

//     private createClients(): PubSub[] {
//         // TODO options for the factory?
//         // return this.factory.getLinkedPubSubImplementation(this.options.numClients);
//         const clients: PubSub[] = [];
//         for (let i = 0; i < this.options.numClients; i++) {

//             const localAddress = this.getLocalAddress();

//             const client = new Client({
//                 serverUrl: "http://localhost:9800",
//                 socketOptions: {
//                     transports: ["websocket"],
//                     forceNew: true,
//                     localAddress
//                 }
//             })
//             clients.push(client);
//         }
//         return clients;

//     }

//     private getLocalAddress() {
//         if (this.options.localAddress) {
//             const ips = getIpAddressList(this.options.localAddress)
//             const randomIdx = getRandomInt(0, ips.length - 1)
//             return ips[randomIdx];
//         } else {
//             return undefined;
//         }
//     }

//     /**
//      * If clients start to fail just display the error of the first failing client
//      */
//     private logErrorOnce = once(msg => console.info(msg))

//     private connectClientDelayed(client: PubSub, delay: number) {
//         return defer(delay)
//             .then(() => {
//                 client.onStop.then(reason => this.logErrorOnce("DISCONNECT: " + JSON.stringify(reason)))
//                 return client.start()
//             })
//     }
// }
