import { describe, expect, it, vi } from 'vitest';
import type { Crag } from '../types';
import { getDefaultCragForHost } from './defaultCrag';

const shulaveri: Crag = { cragId: 'shulaveri', cragName: 'Shulaveri' };
const roshka: Crag = { cragId: 'roshka', cragName: 'Roshka' };
const crags = [shulaveri, roshka];

function stubHostname(hostname: string): void {
  vi.stubGlobal('location', { hostname });
}

describe('getDefaultCragForHost', () => {
  it('returns undefined for an empty list', () => {
    expect(getDefaultCragForHost([])).toBeUndefined();
  });

  it('picks roshka on localhost', () => {
    stubHostname('localhost');
    expect(getDefaultCragForHost(crags)).toEqual(roshka);
  });

  it('picks roshka on roshkaclimb.ge hosts', () => {
    stubHostname('roshkaclimb.ge');
    expect(getDefaultCragForHost(crags)).toEqual(roshka);
    stubHostname('www.roshkaclimb.ge');
    expect(getDefaultCragForHost(crags)).toEqual(roshka);
  });

  it('falls back to the first crag when roshka is missing', () => {
    stubHostname('localhost');
    expect(getDefaultCragForHost([shulaveri])).toEqual(shulaveri);
  });

  it('uses the first crag on other hosts', () => {
    stubHostname('example.com');
    expect(getDefaultCragForHost(crags)).toEqual(shulaveri);
  });
});
