import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/custom-error';
import { UserService } from '../../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as user from './get';

chai.use(sinonChai);

describe('user', () => {
  describe('getUserById', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw a 400 error when no user Id is sent', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        userId: ''
      };

      try {
        const requestHandler = user.getUserById();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Missing required param: userId');
      }
    });

    it('finds user by Id and returns 200 and requestHandler on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        userId: '1'
      };

      sinon.stub(UserService.prototype, 'getUserById').resolves({
        id: 1,
        user_guid: '123456',
        user_identifier: 'user_identifier',
        identity_source: 'identitysource',
        record_end_date: '',
        role_ids: [],
        role_names: []
      });

      const requestHandler = user.getUserById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql({
        id: 1,
        user_guid: '123456',
        user_identifier: 'user_identifier',
        identity_source: 'identitysource',
        record_end_date: '',
        role_ids: [],
        role_names: []
      });
    });
  });
});
