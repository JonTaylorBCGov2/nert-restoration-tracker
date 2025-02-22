import { Feature } from 'geojson';
import shp from 'shpjs';
import { getKnexQueryBuilder } from '../database/db';
import { HTTP400 } from '../errors/custom-error';
import {
  GetTreatmentFeatureTypes,
  GetTreatmentTypes,
  ITreatmentDataInsertOrExists,
  ITreatmentTypeInsertOrExists,
  ITreatmentUnitInsertOrExists,
  ValidTreatmentFeature,
  ValidTreatmentFeatureProperties
} from '../models/project-treatment';
import { GetTreatmentData } from '../models/treatment-view';
import { queries } from '../queries/queries';
import { DBService } from './service';

export type TreatmentSearchCriteria = {
  years?: string[];
};

export class TreatmentService extends DBService {
  async parseShapeFile(fileBuffer: Buffer): ReturnType<typeof shp.parseZip> {
    return shp.parseZip(fileBuffer);
  }

  /**
   * Parses a shapefile into an array of geojson features.
   *
   * @param {Express.Multer.File} file
   * @return {*}  {(Promise<Feature[] | null>)}
   * @memberof TreatmentService
   */
  async parseShapefile(file: Express.Multer.File): Promise<Feature[] | null> {
    // Exit out if no file
    if (!file) {
      return null;
    }

    // Run the conversion
    const geojson = await this.parseShapeFile(file.buffer);

    if (!geojson) {
      return null;
    }

    let features: Feature[] = [];
    if (Array.isArray(geojson)) {
      geojson.forEach((item) => {
        features = features.concat(item.features);
      });
    } else {
      features = geojson.features;
    }
    return features;
  }

  /**
   * Parses an array of geojson features, validating and transforming their properties.
   *
   * @param {Feature[]} treatmentFeatures
   * @return {*}  {Promise<{ errors: { treatmentUnitId: string; errors: string[] }[]; data: ValidTreatmentFeature[] }>}
   * @memberof TreatmentService
   */
  async parseFeatures(
    treatmentFeatures: Feature[]
  ): Promise<{ errors: { treatmentUnitId: string; errors: string[] }[]; data: ValidTreatmentFeature[] }> {
    const allErrors: { treatmentUnitId: string; errors: string[] }[] = [];

    const [treatmentFeatureTypeObjects, treatmentUnitTypeObjects] = await Promise.all([
      this.getAllTreatmentFeatureTypes(),
      this.getAllTreatmentUnitTypes()
    ]);

    const validatedTreatmentFeatures: ValidTreatmentFeature[] = [];

    for (const treatmentFeature of treatmentFeatures) {
      // parse the feature properties
      const result = ValidTreatmentFeatureProperties(treatmentFeatureTypeObjects, treatmentUnitTypeObjects).safeParse(
        treatmentFeature.properties
      );

      if (!result.success) {
        allErrors.push({
          treatmentUnitId:
            (treatmentFeature.properties?.TU_ID && String(treatmentFeature.properties.TU_ID)) || 'Invalid TU_ID',
          errors: result.error.errors.map((item) => `${item.path[0]} - ${item.message}`)
        });
      } else {
        // re-assemble the feature with the successfully parsed properties
        validatedTreatmentFeatures.push({ ...treatmentFeature, properties: result.data });
      }
    }

    return { errors: allErrors, data: validatedTreatmentFeatures };
  }

  async getAllTreatmentFeatureTypes(): Promise<GetTreatmentFeatureTypes[]> {
    const sqlStatement = queries.project.getTreatmentFeatureTypesSQL();

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL get statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response.rows) {
      throw new HTTP400('Failed to get project treatment feature type data');
    }

    return response.rows;
  }

  async getAllTreatmentUnitTypes(): Promise<GetTreatmentTypes[]> {
    const sqlStatement = queries.project.getTreatmentUnitTypesSQL();

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL get statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response.rows) {
      throw new HTTP400('Failed to get project treatment unit type data');
    }

    return response.rows;
  }

  async insertTreatmentUnit(projectId: number, feature: ValidTreatmentFeature): Promise<ITreatmentUnitInsertOrExists> {
    const sqlStatement = queries.project.postTreatmentUnitSQL(projectId, feature.properties.Fe_Type, feature);

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL insert statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response.rows || !response.rows[0]) {
      throw new HTTP400('Failed to insert treatment unit data');
    }

    return response.rows[0];
  }

  async insertTreatmentData(
    treatmentUnitId: number,
    year: string | number,
    implemented: string | null
  ): Promise<ITreatmentDataInsertOrExists> {
    const sqlStatement = queries.project.postTreatmentDataSQL(treatmentUnitId, year, implemented);

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL insert statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response?.rows?.[0]) {
      throw new HTTP400('Failed to insert treatment data');
    }

    return response.rows[0];
  }

  async insertTreatmentType(treatmentId: number, treatmentTypeId: number): Promise<ITreatmentTypeInsertOrExists> {
    const sqlStatement = queries.project.postTreatmentTypeSQL(treatmentId, treatmentTypeId);

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL insert statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response.rows || !response.rows[0]) {
      throw new HTTP400('Failed to insert treatment unit type data');
    }

    return response.rows[0];
  }

  async insertAllTreatmentTypes(
    treatmentId: number,
    treatmentFeatureProperties: ValidTreatmentFeatureProperties
  ): Promise<void> {
    for (const treatmentTypeId of treatmentFeatureProperties.Treatments) {
      const response = await this.insertTreatmentType(treatmentId, treatmentTypeId);

      if (!response || !response.treatment_treatment_type_id) {
        throw new HTTP400('Failed to insert treatment unit type data');
      }
    }
  }

  async insertTreatmentDataAndTreatmentTypes(
    treatmentUnitId: number,
    featureProperties: ValidTreatmentFeatureProperties
  ): Promise<void> {
    const insertTreatmentDataResponse = await this.insertTreatmentData(
      treatmentUnitId,
      featureProperties.Year,
      featureProperties.Implement
    );

    await this.insertAllTreatmentTypes(insertTreatmentDataResponse.treatment_id, featureProperties);
  }

  async insertAllProjectTreatmentUnits(projectId: number, features: ValidTreatmentFeature[]): Promise<number[]> {
    const treatmentInsertResponse: number[] = [];

    for (const feature of features) {
      const checkTreatmentUnitExist = await this.getTreatmentUnitExist(
        projectId,
        feature.properties.Fe_Type,
        feature.properties?.TU_ID
      );

      if (!checkTreatmentUnitExist) {
        // Treatment Unit Doesn't Exist
        const insertTreatmentUnitResponse = await this.insertTreatmentUnit(projectId, feature);

        await this.insertTreatmentDataAndTreatmentTypes(
          insertTreatmentUnitResponse.treatment_unit_id,
          feature.properties
        );

        treatmentInsertResponse.push(insertTreatmentUnitResponse.treatment_unit_id);
      } else {
        // Treatment Unit Exists
        const checkTreatmentDataYearExists = await this.getTreatmentDataYearExist(
          checkTreatmentUnitExist.treatment_unit_id,
          feature.properties?.Year
        );

        if (!checkTreatmentDataYearExists) {
          // Treatment with Year doesn't exist in db
          await this.insertTreatmentDataAndTreatmentTypes(
            checkTreatmentUnitExist.treatment_unit_id,
            feature.properties
          );
          treatmentInsertResponse.push(checkTreatmentUnitExist.treatment_unit_id);
        }

        // Data already exists
      }
    }

    return treatmentInsertResponse;
  }

  async getTreatmentUnitExist(
    projectId: number,
    featureTypeId: number,
    treatmentUnitName: string | number
  ): Promise<ITreatmentUnitInsertOrExists | null> {
    const sqlStatement = queries.project.getTreatmentUnitExistSQL(projectId, featureTypeId, treatmentUnitName);

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL update statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response?.rows) {
      return null;
    }

    return response.rows[0];
  }

  async getTreatmentDataYearExist(treatmentUnitId: number, year: number): Promise<ITreatmentDataInsertOrExists | null> {
    const sqlStatement = queries.project.getTreatmentDataYearExistSQL(treatmentUnitId, year);

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL update statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response?.rows) {
      return null;
    }

    return response.rows[0];
  }

  async getTreatmentsByCriteria(projectId: number, criteria: TreatmentSearchCriteria): Promise<GetTreatmentData> {
    const queryBuilder = getKnexQueryBuilder<any, { project_id: number }>()
      .select(
        'treatment_unit.name as id',
        'feature_type.name as type',
        'treatment_unit.width',
        'treatment_unit.length',
        'treatment_unit.area',
        'treatment.year as treatment_year',
        'treatment.implemented',
        'treatment_type.name as treatment_name',
        'treatment_unit.reconnaissance_conducted',
        'treatment_unit.comments',
        'treatment_unit.geojson'
      )
      .from('treatment_unit');
    queryBuilder.leftJoin('feature_type', 'treatment_unit.feature_type_id', 'feature_type.feature_type_id');
    queryBuilder.leftJoin('treatment', 'treatment_unit.treatment_unit_id', 'treatment.treatment_unit_id');
    queryBuilder.leftJoin(
      'treatment_treatment_type',
      'treatment.treatment_id',
      'treatment_treatment_type.treatment_id'
    );
    queryBuilder.leftJoin(
      'treatment_type',
      'treatment_treatment_type.treatment_type_id',
      'treatment_type.treatment_type_id'
    );

    if (criteria.years) {
      queryBuilder.and.whereIn('treatment.year', (Array.isArray(criteria.years) && criteria.years) || [criteria.years]);
    }

    queryBuilder.groupBy('treatment_unit.name');
    queryBuilder.groupBy('feature_type.name');
    queryBuilder.groupBy('treatment_unit.width');
    queryBuilder.groupBy('treatment_unit.length');
    queryBuilder.groupBy('treatment_unit.area');
    queryBuilder.groupBy('treatment.year');
    queryBuilder.groupBy('treatment.implemented');
    queryBuilder.groupBy('treatment_type.name');
    queryBuilder.groupBy('treatment_unit.reconnaissance_conducted');
    queryBuilder.groupBy('treatment_unit.comments');
    queryBuilder.groupBy('treatment_unit.geojson');

    queryBuilder.where('treatment_unit.project_id', projectId);

    const response = await this.connection.knex(queryBuilder);

    const rawTreatmentsData = response && response.rows ? response.rows : [];

    return new GetTreatmentData(rawTreatmentsData);
  }

  async deleteTreatmentUnit(projectId: number, treatmentUnitId: number) {
    const sqlStatement = queries.project.deleteProjectTreatmentUnitSQL(projectId, treatmentUnitId);

    await this.connection.query(sqlStatement.text, sqlStatement.values);
  }

  async deleteTreatments(projectId: number) {
    const deleteProjectTreatmentsSQL = queries.project.deleteProjectTreatmentsSQL(projectId);
    await this.connection.query(deleteProjectTreatmentsSQL.text, deleteProjectTreatmentsSQL.values);
  }

  async getProjectTreatmentsYears(projectId: number) {
    const sqlStatement = queries.project.getProjectTreatmentsYearsSQL(projectId);

    if (!sqlStatement) {
      throw new HTTP400('Failed to build SQL update statement');
    }

    const response = await this.connection.query(sqlStatement.text, sqlStatement.values);

    if (!response || !response?.rows) {
      return null;
    }

    return response.rows;
  }
}
