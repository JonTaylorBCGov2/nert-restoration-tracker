import chai, { expect } from 'chai';
import { Feature } from 'geojson';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/custom-error';
import { GetTreatmentData } from '../../../../models/treatment-view';
import { TreatmentService } from '../../../../services/treatment-service';
import { getMockDBConnection } from '../../../../__mocks__/db';
import { getTreatments } from './list';

chai.use(sinonChai);

describe('getTreatments', () => {
  const dbConnectionObj = getMockDBConnection();

  const sampleReq = {
    keycloak_token: {},
    body: {},
    params: {
      projectId: 1
    }
  } as any;

  let actualResult: any = null;

  const sampleRes = {
    status: () => {
      return {
        json: (result: any) => {
          actualResult = result;
        }
      };
    }
  };

  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when no projectId is provided', async () => {
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    try {
      await getTreatments()(
        { ...sampleReq, params: { ...sampleReq.params, projectId: null } },
        (null as unknown) as any,
        (null as unknown) as any
      );
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('Missing required path param `projectId`');
    }
  });

  it('should return a list of project treatments, on success', async () => {
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const sampleTreatmentList = [
      {
        id: '1',
        type: 'Other',
        width: 240,
        length: 3498,
        area: 839520,
        geojson: [{} as Feature],
        reconnaissance_conducted: 'no',
        implemented: 'yes',
        comments: '',
        treatment_year: '2020',
        treatment_name: 'Seeding'
      },
      {
        id: '1',
        type: 'Other',
        width: 240,
        length: 3498,
        area: 839520,
        geojson: [{} as Feature],
        reconnaissance_conducted: 'not applicable',
        implemented: 'no',
        comments: '',
        treatment_year: '2021',
        treatment_name: 'Tree Felling'
      }
    ];

    sinon
      .stub(TreatmentService.prototype, 'getTreatmentsByCriteria')
      .resolves(new GetTreatmentData(sampleTreatmentList));

    await getTreatments()(sampleReq, sampleRes as any, (null as unknown) as any);

    const resultItem = {
      treatmentList: [
        {
          id: '1',
          type: 'Other',
          width: 240,
          length: 3498,
          area: 839520,
          geometry: {},
          reconnaissance_conducted: 'no',
          comments: '',
          treatments: [
            {
              treatment_year: '2020',
              treatment_name: 'Seeding',
              implemented: 'yes'
            },
            {
              treatment_year: '2021',
              treatment_name: 'Tree Felling',
              implemented: 'no'
            }
          ]
        }
      ]
    };

    expect(actualResult).to.be.eql(resultItem);
  });
});
