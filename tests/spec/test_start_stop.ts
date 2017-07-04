if (typeof window === "undefined") {
    var c = require('chai');
    let chaiAsPromised = require("chai-as-promised");
    c.use(chaiAsPromised);
    c.should();
    var expect = c.expect;
    var randomValidChannelOrTopicName = require('../test_helper').randomValidChannelOrTopicName;
}

const executeStartStopTests = (factory) => {

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
                        expect(pubsub.clientId).to.be.defined;
                        expect(pubsub.clientId).to.be.a("string");
                        expect(pubsub.clientId.length).to.be.greaterThan(4);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });
        })

        it("should set isStarted from true to false after the instance is started", done => {
            expect(pubsub.isStarted).to.equal(false);
            pubsub.start().then(() => {
                expect(pubsub.isStarted).to.equal(true);
                done();
            })
        })

        it("should resolve the onStart promise after the start method is complete", done => {
            pubsub.onStart.then(done);
            pubsub.start();
        })

        it("should set the onStart promise after the creation of the pubsub constructor is done", () => {
            expect(pubsub.onStart).to.be.ok;
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

        it("should throw an error if calling start() again after the stop() function", () => {
            return pubsub.start()
                .then(() => pubsub.stop())
                .then(() => pubsub.start())
                .should.eventually.be.rejected;
        });

        it("should be allowed to call stop multiple times", () => {
            return pubsub.start().then(() => {
                return Promise.all([
                    pubsub.stop(),
                    pubsub.stop(),
                    pubsub.stop(),
                ]).should.eventually.be.fulfilled;
            });
        });

        it("should resolve the onStop promise after the stop method is complete", done => {
            pubsub.onStop.then(() => done());
            pubsub.start().then(() => pubsub.stop());
        })

        it("should resolve the promise after the pubsub was stopped", () => {
            return pubsub.start()
                .then(() => pubsub.stop())
                .should.eventually.be.fulfilled;
        })

        it("should reject the promise when calling publish after the .stop function has been called", () => {
            return start_and_create_channel().then(channel => {
                return pubsub.stop()
                    .then(() => channel.publish(topic, "foo"))
                    .should.eventually.be.rejected
                    .and.be.an.instanceOf(Error);
            })
        });

        it("should reject the promise when calling subscribe after the .stop function has been called", () => {
            return start_and_create_channel().then(channel => {
                return pubsub.stop()
                    .then(() => channel.subscribe(topic, () => void 0))
                    .should.eventually.be.rejected
                    .and.be.an.instanceOf(Error);
            });
        });

        it("should reject the promise when creating a channel if the .stop function has been called", () => {
            return start_and_create_channel().then(channel => {
                return pubsub.stop().then(() => pubsub.channel(topic, () => void 0))
                    .should.eventually.be.rejected
                    .and.be.an.instanceOf(Error);
            });
        });
    });
}

if (typeof window === "undefined") {
    module.exports = {
        executeStartStopTests: executeStartStopTests
    };
}
