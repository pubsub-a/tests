import { expect } from "chai";
import { Observable } from "rxjs";

import { ImplementationFactory } from "@dynalon/pubsub-a-interfaces";
import { randomString, randomValidChannelOrTopicName } from "../test_helper";

export const executeStartStopTests = (factory: ImplementationFactory) => {

    describe(`['${factory.name}] should pass the start/stop implementation test`, () => {

        let pubsub;
        let topic;
        let channel_name;

        let start_and_create_channel = () => {
            return pubsub.start().then(() => {
                return pubsub.channel(channel_name);
            });
        };

        beforeEach(() => {
            pubsub = factory.getPubSubImplementation();
            topic = randomValidChannelOrTopicName();
            channel_name = randomValidChannelOrTopicName();
        });

        it("should set a clientId after start() is done via promise", function (done) {
            if (factory.name == "PubSubMicro") {
                this.skip();
                return;
            }

            pubsub.start()
                .catch(v => console.log(v))
                .then(() => {
                    try {
                        expect(pubsub.clientId).to.be.ok;
                        expect(pubsub.clientId).to.be.a("string");
                        expect(pubsub.clientId.length).to.be.greaterThan(4);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });
        })

        it("should set isStarted immediatelly from true to false after the instance is started", done => {
            expect(pubsub.isStarted).to.equal(false);
            pubsub.start().then(() => {
                expect(pubsub.isStarted).to.equal(true);
                done();
            })

        })

        it("should resolve with the pubsub instance in the .start() promise", done => {
            pubsub.start().then(p => {
                expect(p).to.be.ok;
                expect(p.channel).to.be.a("function");
                expect(p.clientId).to.be.a("string");
                expect(p.clientId).to.equal(pubsub.clientId);
                expect(p.isStarted).to.equal(true);
                expect(pubsub.isStarted).to.equal(true);
                done();
            }).catch(err => done(err));
        })

        it("should not allow to stop an instance before it was started", () => {
            expect(() => pubsub.stop()).to.throw();
        })

        it("should set the onStop promise after the creation of the pubsub constructor is done", () => {
            expect(pubsub.onStop).to.be.ok;
        })

        it("should throw an exception when trying to start an already started instance", done => {
            pubsub.start().then(() => {
                try {
                    pubsub.start();
                    done("Second call to .start() did not throw an error");
                } catch (err) {
                    done();
                }
            })
        })

        it("should throw an error if calling start() again after the stop() function", (done) => {
            pubsub.start()
                .then(() => pubsub.stop())
                .then(() => pubsub.start())
                .catch(() => done())
        });

        it("should be allowed to call stop multiple times", (done) => {
            pubsub.start().then(() => {
                return Promise.all([
                    pubsub.stop(),
                    pubsub.stop(),
                    pubsub.stop(),
                ]).then(() => done());
            });
        });

        it("should resolve the onStop promise after the stop method is complete", done => {
            pubsub.onStop.then(() => done());
            pubsub.start().then(() => pubsub.stop());
        })

        it("should resolve the returned promise after the pubsub was stopped with .stop()", (done) => {
            pubsub.start()
                .then(() => pubsub.stop())
                .then(() => done());
        })

        it("should reject the promise when calling publish after the .stop function has been called", done => {
            start_and_create_channel().then(channel => {
                pubsub.stop()
                    .then(() => channel.publish(topic, "foo"))
                    .catch(err => {
                        expect(err).to.be.an.instanceOf(Error);
                        done();
                    })
            })
        });

        it("should reject the promise when calling subscribe after the .stop function has been called", done => {
            start_and_create_channel().then(channel => {
                pubsub.stop()
                    .then(() => channel.subscribe(topic, () => void 0))
                    .catch(err => {
                        expect(err).to.be.an.instanceOf(Error);
                        done();
                    })
            });
        });

        it("should reject the promise when creating a channel if the .stop function has been called", done => {
            start_and_create_channel().then(channel => {
                pubsub.stop().then(() => pubsub.channel(topic, () => void 0))
                    .catch(err => {
                        expect(err).to.be.an.instanceOf(Error);
                        done();
                    })
            });
        });

        it("should report correct error code when the local end disconnects", (done) => {
            pubsub.onStop.then(status => {
                expect(status.reason).to.equal("LOCAL_DISCONNECT");
                done();
            })
            pubsub.start().then(() => {
                pubsub.stop({ reason: "LOCAL_DISCONNECT" });
            })
        })
    });
}