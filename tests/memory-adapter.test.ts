import { MemoryAdapter, createMemoryAdapter } from '../src/adapters/memory-adapter';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  afterEach(() => {
    adapter.close();
  });

  describe('initialization', () => {
    it('should create adapter', () => {
      expect(adapter).toBeInstanceOf(MemoryAdapter);
      expect(adapter.protocol).toBe('custom');
    });

    it('should start in connected state', () => {
      expect(adapter.getState()).toBe('connected');
    });

    it('should create via factory', () => {
      const a = createMemoryAdapter();
      expect(a).toBeInstanceOf(MemoryAdapter);
      a.close();
    });
  });

  describe('send operations', () => {
    it('should buffer sent data', () => {
      adapter.send(Buffer.from('hello'));
      adapter.send(Buffer.from('world'));

      const sent = adapter.getSentData();
      expect(sent.length).toBe(2);
      expect(sent[0].toString()).toBe('hello');
      expect(sent[1].toString()).toBe('world');
    });

    it('should get last sent data', () => {
      adapter.send(Buffer.from('first'));
      adapter.send(Buffer.from('second'));

      const last = adapter.getLastSent();
      expect(last?.toString()).toBe('second');
    });

    it('should return undefined for last sent when empty', () => {
      expect(adapter.getLastSent()).toBeUndefined();
    });

    it('should call send callback', (done) => {
      adapter.send(Buffer.from('test'), () => {
        done();
      });
    });
  });

  describe('receive operations', () => {
    it('should buffer received data', () => {
      adapter.receive(Buffer.from('incoming'));

      const received = adapter.getReceivedData();
      expect(received.length).toBe(1);
      expect(received[0].toString()).toBe('incoming');
    });

    it('should emit data to handlers', (done) => {
      adapter.onData((data) => {
        expect(data.toString()).toBe('test data');
        done();
      });

      adapter.receive(Buffer.from('test data'));
    });
  });

  describe('statistics', () => {
    it('should track statistics', () => {
      adapter.send(Buffer.from('abc'));
      adapter.send(Buffer.from('defgh'));
      adapter.receive(Buffer.from('12345'));

      const stats = adapter.getStats();
      expect(stats.sentCount).toBe(2);
      expect(stats.sentBytes).toBe(8); // 3 + 5
      expect(stats.receivedCount).toBe(1);
      expect(stats.receivedBytes).toBe(5);
    });

    it('should start with zero stats', () => {
      const stats = adapter.getStats();
      expect(stats.sentCount).toBe(0);
      expect(stats.receivedCount).toBe(0);
    });
  });

  describe('clear operation', () => {
    it('should clear all buffers', () => {
      adapter.send(Buffer.from('sent'));
      adapter.receive(Buffer.from('received'));

      adapter.clear();

      expect(adapter.getSentData().length).toBe(0);
      expect(adapter.getReceivedData().length).toBe(0);
    });
  });

  describe('loopback mode', () => {
    it('should echo sent data to receive', (done) => {
      adapter.enableLoopback();

      adapter.onData((data) => {
        expect(data.toString()).toBe('loopback test');
        done();
      });

      adapter.send(Buffer.from('loopback test'));
    });

    it('should still buffer sent data in loopback', (done) => {
      adapter.enableLoopback();

      adapter.onData(() => {
        const sent = adapter.getSentData();
        expect(sent.length).toBe(1);
        done();
      });

      adapter.send(Buffer.from('test'));
    });
  });

  describe('state management', () => {
    it('should transition to disconnected on close', () => {
      adapter.close();
      expect(adapter.getState()).toBe('disconnected');
    });

    it('should emit close event', (done) => {
      adapter.on('close', () => {
        done();
      });

      adapter.close();
    });

    it('should not send when disconnected', (done) => {
      adapter.close();

      adapter.send(Buffer.from('test'), (err) => {
        expect(err).toBeDefined();
        done();
      });
    });
  });

  describe('metadata', () => {
    it('should return metadata', () => {
      const meta = adapter.getMetadata();

      expect(meta.protocol).toBe('custom');
      expect(meta.connectionState).toBe('connected');
    });
  });
});
