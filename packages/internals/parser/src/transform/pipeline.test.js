/* eslint handle-callback-err: off, no-unused-expressions: off */
const {EventEmitter2} = require('eventemitter2');
const {ComponentCollection, File, Component} = require('@frctl/support');
const {expect, sinon} = require('../../../../../test/helpers');
const Pipeline = require('./pipeline');
const fileTransform = require('./file-transform')();

const toCC = items => new ComponentCollection(items);

const filesToComps = files => {
  const comps = files.toArray().map(f => {
    return new Component({
      src: new File({path: f.dirname}),
      name: f.stem
    });
  });
  return ComponentCollection.from(comps);
};

const validCCTransform = {
  name: 'valid-transform',
  transform: toCC
};
const filesToCompsTrans = {
  name: 'files-to-comps',
  transform: filesToComps,
  plugins: {
    name: 'plugin-status',
    collection: 'files',
    handler: items => items.map(i => Object.assign(i, {
      ready: true
    }))
  }
};
const invalidTransform = {
  name: 'invalid-transform'
};
const noOpTransform = {
  name: 'no-op',
  transform: i => i
};

const makePipeline = props => new Pipeline(props);

describe('Pipeline', function () {
  describe('constructor', function () {
    it('returns a new instance if correct properties provided', function () {
      const pipeline = makePipeline();
      expect(pipeline instanceof Pipeline).to.be.true;
    });
    it('assigns transforms passed in', function () {
      const pipeline = makePipeline([fileTransform, validCCTransform]);
      expect(pipeline.transforms.length).to.equal(2);
    });
    it('throws an error if invalid transforms are passed in', function () {
      expect(() => makePipeline('invalid string')).to.throw(TypeError, '[invalid-transforms]');
      expect(() => makePipeline({})).to.throw(TypeError, '[invalid-transforms]');
      expect(() => makePipeline([invalidTransform])).to.throw(TypeError, '[invalid-properties]');
    });
  });
  describe('.transforms', function () {
    it(`has a 'transforms' getter`, function () {
      const pipeline = makePipeline();
      expect(pipeline.transforms).to.eql([]);
    });
  });
  describe('.addTransform()', function () {
    it(`successfully adds valid single transform`, function () {
      const pipeline = makePipeline();
      pipeline.addTransform(fileTransform);
      expect(pipeline.transforms.length).to.eql(1);
    });
    it(`throws an error if invalid transform is passed in`, function () {
      const pipeline = makePipeline();
      expect(() => pipeline.addTransform('invalid')).to.throw(TypeError, '[invalid-properties]');
    });
    it('overwrites preceeding transforms with the same name', function () {
      const pipeline = makePipeline();
      pipeline.addTransform(fileTransform);
      expect(pipeline.transforms.length).to.eql(1);
      pipeline.addTransform(fileTransform);
      expect(pipeline.transforms.length).to.eql(1);
    });
  });
  describe('.getTransform()', function () {
    it('retrieves the correct transform', function () {
      const pipeline = makePipeline([fileTransform, validCCTransform]);
      const transform = pipeline.getTransform('valid-transform');
      expect(transform).to.be.a('Transform');
      expect(transform.transform).to.equal(toCC);
    });
  });
  describe('.process()', async function () {
    it('processes data correctly', async function () {
      const pipeline = makePipeline([fileTransform, filesToCompsTrans]);
      const emitter = new EventEmitter2();
      const spy = sinon.spy(emitter, 'emit');
      const data = [new File({
        path: '/components/button/button.hbs'
      }), new File({
        path: '/components/button/button.js'
      })];
      const context = {};
      const result = await pipeline.process(data, context, emitter);
      expect(spy.calledWith('process.start', data, context)).to.be.true;
      expect(spy.calledWith('process.complete', result)).to.be.true;
      expect(result).to.be.an('object').with.a.property('files-to-comps')
      .that.is.a('ComponentCollection');
      expect(result).to.be.an('object').with.a.property('files')
      .that.is.a('FileCollection');
    });
    it(`does not pass 'data' to next transform when 'passthru' is false`, async function () {
      const emitter = new EventEmitter2();
      const data = [new File({
        path: '/components/button/button.hbs'
      }), new File({
        path: '/components/button/button.js'
      })];
      const context = {};

      const noPassThru = Object.assign(fileTransform, {passthru: false});
      const pipelineNoPass = makePipeline([noPassThru, noOpTransform]);
      const result = await pipelineNoPass.process(data, context, emitter);

      expect(result).to.be.an('object').with.a.property('no-op').that.is.a('Collection').with.a.property('_items').that.equals(data);
    });
    it(`passes 'data' to next transform when 'passthru' is true`, async function () {
      const emitter = new EventEmitter2();
      const data = [new File({
        path: '/components/button/button.hbs'
      }), new File({
        path: '/components/button/button.js'
      })];
      const context = {};

      const passThru = Object.assign(fileTransform, {passthru: true});
      const pipelineWithPass = makePipeline([passThru, noOpTransform]);
      const result = await pipelineWithPass.process(data, context, emitter);

      expect(result).to.be.an('object').with.a.property('no-op').that.is.a('FileCollection').with.a.property('_items').that.eqls(data);
    });
  });
});
