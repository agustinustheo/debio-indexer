import { ApiPromise } from '@polkadot/api';
import 'regenerator-runtime/runtime';
import {
  deregisterLab,
  stakeLab,
  unstakeLab,
} from '@debionetwork/polkadot-provider/lib/command/labs';
import { queryLabById } from '@debionetwork/polkadot-provider/lib/query/labs';
import { Lab } from '@debionetwork/polkadot-provider/lib/models/labs';
import { registerLab } from '@debionetwork/polkadot-provider/lib/command/labs';
import { labDataMock } from '../../../../../mock/models/labs/labs.mock';
import { TestingModule } from '@nestjs/testing/testing-module';
import { Test } from '@nestjs/testing/test';
import { INestApplication } from '@nestjs/common/interfaces/nest-application.interface';
import { initializeApi } from '../../../../polkadot-init';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { LabRating } from '../../../../../mock/models/rating/rating.entity';
import { TransactionRequest } from '../../../../../../src/common/transaction-logging/models/transaction-request.entity';
import { LocationEntities } from '../../../../../../src/common/location/models';
import { dummyCredentials } from '../../../../config';
import { EscrowService } from '../../../../../../src/common/escrow/escrow.service';
import { escrowServiceMockFactory } from '../../../../../unit/mock';
import {
  DateTimeModule,
  DebioConversionModule,
  MailModule,
  NotificationModule,
  ProcessEnvModule,
  SubstrateModule,
  TransactionLoggingModule,
} from '../../../../../../src/common';
import { LocationModule } from '../../../../../../src/common/location/location.module';
import { CqrsModule } from '@nestjs/cqrs';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SubstrateListenerHandler } from '../../../../../../src/listeners/substrate-listener/substrate-listener.handler';
import { createConnection } from 'typeorm';
import { LabCommandHandlers } from '../../../../../../src/listeners/substrate-listener/commands/labs';
import {
  GCloudSecretManagerModule,
  GCloudSecretManagerService,
} from '@debionetwork/nestjs-gcloud-secret-manager';

describe('Lab unstaking Integration Tests', () => {
  let app: INestApplication;

  let api: ApiPromise;
  let pair: any;
  let lab: Lab;

  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  class GoogleSecretManagerServiceMock {
    _secretsList = new Map<string, string>([
      ['ELASTICSEARCH_NODE', process.env.ELASTICSEARCH_NODE],
      ['ELASTICSEARCH_USERNAME', process.env.ELASTICSEARCH_USERNAME],
      ['ELASTICSEARCH_PASSWORD', process.env.ELASTICSEARCH_PASSWORD],
      ['SUBSTRATE_URL', process.env.SUBSTRATE_URL],
      ['ADMIN_SUBSTRATE_MNEMONIC', process.env.ADMIN_SUBSTRATE_MNEMONIC],
      ['EMAIL', process.env.EMAIL],
      ['PASS_EMAIL', process.env.PASS_EMAIL],
    ]);
    loadSecrets() {
      return null;
    }

    getSecret(key) {
      return this._secretsList.get(key);
    }
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        GCloudSecretManagerModule.withConfig(process.env.PARENT),
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...dummyCredentials,
          database: 'db_postgres',
          entities: [LabRating, TransactionRequest],
          autoLoadEntities: true,
        }),
        TypeOrmModule.forRoot({
          name: 'dbLocation',
          ...dummyCredentials,
          database: 'db_postgres',
          entities: [...LocationEntities],
          autoLoadEntities: true,
        }),
        LocationModule,
        TransactionLoggingModule,
        SubstrateModule,
        DebioConversionModule,
        MailModule,
        CqrsModule,
        DateTimeModule,
        NotificationModule,
      ],
      providers: [
        {
          provide: EscrowService,
          useFactory: escrowServiceMockFactory,
        },
        SubstrateListenerHandler,
        ...LabCommandHandlers,
      ],
    })
      .overrideProvider(GCloudSecretManagerService)
      .useClass(GoogleSecretManagerServiceMock)
      .compile();

    app = module.createNestApplication();
    await app.init();

    const { api: _api, pair: _pair } = await initializeApi();
    api = _api;
    pair = _pair;
  }, 360000);

  afterAll(async () => {
    await api.disconnect();
    await app.close();
  });

  it('lab unstaking event', async () => {
    // eslint-disable-next-line
    const labPromise: Promise<Lab> = new Promise((resolve, reject) => {
      registerLab(api, pair, labDataMock.info, () => {
        queryLabById(api, pair.address).then((res) => {
          resolve(res);
        });
      });
    });

    lab = await labPromise;
    expect(lab.stakeStatus).toEqual('Unstaked');

    // eslint-disable-next-line
    const stakedLabPromise: Promise<Lab> = new Promise((resolve, reject) => {
      stakeLab(api, pair, () => {
        queryLabById(api, pair.address).then((res) => {
          resolve(res);
        });
      });
    });

    lab = await stakedLabPromise;
    expect(lab.stakeStatus).toEqual('Staked');

    // eslint-disable-next-line
    const unstakedLabPromise: Promise<Lab> = new Promise((resolve, reject) => {
      unstakeLab(api, pair, () => {
        queryLabById(api, pair.address).then((res) => {
          resolve(res);
        });
      });
    });

    lab = await unstakedLabPromise;
    expect(lab.stakeStatus).toEqual('WaitingForUnstaked');

    const dbConnection = await createConnection({
      ...dummyCredentials,
      database: 'db_postgres',
      entities: [TransactionRequest],
      synchronize: true,
    });

    const transactionLogs = await dbConnection
      .getRepository(TransactionRequest)
      .createQueryBuilder('transaction_logs')
      .where('transaction_logs.transaction_type = :transaction_type', {
        transaction_type: 6,
      })
      .where('transaction_logs.transaction_status = :transaction_status', {
        transaction_status: 27,
      })
      .getMany();

    expect(transactionLogs[0].ref_number).toEqual(lab.accountId);
    expect(transactionLogs[0].transaction_type).toEqual(6);
    expect(transactionLogs[0].transaction_status).toEqual(27);

    await deregisterLab(api, pair);
  }, 210000);
});