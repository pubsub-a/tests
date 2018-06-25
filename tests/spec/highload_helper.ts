import { ImplementationFactory, ObserverFunc, PubSub, SubscriptionToken } from "@dynalon/pubsub-a-interfaces";

interface LoadTestOptions {
    numClients: number
    socketsPerSecond: number;
}

export let defaultLoadTestOptions: LoadTestOptions = {
    numClients: 8192,
    socketsPerSecond: 100,
}

function defer(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

export class ClientCluster {
    public readonly options: LoadTestOptions;
    public readonly clients: PubSub[];

    constructor(private factory: ImplementationFactory, options: Partial<LoadTestOptions> = {}) {
        this.options = { ...defaultLoadTestOptions, ...options } as LoadTestOptions;
        this.clients = this.createClients();
    }

    connectClients(): Promise<PubSub[]> {
        let connectedClients: Promise<PubSub>[] = [];
        const clients = [...this.clients];

        // since most systems will error (SOCKET_ERR) when creating too many sockets at once, we do it
        // gracefully
        let slice = clients.splice(0, this.options.socketsPerSecond);
        let secondsIteration = 0;
        while (slice.length > 0) {
            const promises = slice.map(client => this.connectClientDelayed(client, secondsIteration * 1_000))
            connectedClients = [...connectedClients, ...promises]
            secondsIteration++;
            slice = clients.splice(0, this.options.socketsPerSecond);
        }

        return Promise.all(connectedClients);
    }

    subscribeClients<T>(channelName: string, topic: string, observer: ObserverFunc<T>): Promise<SubscriptionToken[]> {
        return Promise.all(this.clients.map(client => client.channel(channelName)))
            .then(channels => Promise.all(channels.map(chan => chan.subscribe(topic, observer))))
    }

    publishClients<T>(channelName: string, topic: string, payload: T): Promise<any> {
        return Promise.all(this.clients.map(client => client.channel(channelName)))
            .then(channels => Promise.all(channels.map(chan => chan.publish(topic, payload))))
    }

    dispose(): Promise<any> {
        return Promise.all(this.clients.map(client => client.stop({ reason: "LOCAL_DISCONNECT" })))
    }

    private createClients(): PubSub[] {
        return this.factory.getLinkedPubSubImplementation(this.options.numClients);
    }

    private connectClientDelayed(client: PubSub, delay: number) {
        return defer(delay).then(() => client.start());
    }
}