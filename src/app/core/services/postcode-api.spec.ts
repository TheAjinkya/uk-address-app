import { TestBed } from '@angular/core/testing';

import { PostcodeApi } from './postcode-api';

describe('PostcodeApi', () => {
  let service: PostcodeApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PostcodeApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
