var factories = [];

// structure of a pubsub implementation factory:
// interface sampleFactory  {

//     // gets a standard single instance of IPubSub implementation
//     getPubSubImplementation(): IPubSub;

//     // gets "linked" instances, i.e. that means their publish/subscribe data is shared - usefull for networked
//     // implementations where two instances share data on two different machines / JS runtimes.
//     getLinkedPubSubImplementation(numInstances: number): Array<IPubSub>;

//     // name of the pubsub implementation
//     name: string;
// }

function registerPubSubImplementationFactory(factory) {
    (factories as any).push(factory);
}

if (typeof window === "undefined") {
    module.exports = {
        factories: factories,
        registerPubSubImplementationFactory: registerPubSubImplementationFactory
    };
}
