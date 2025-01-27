import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionLoggingDto } from '../../../../../common/transaction-logging/dto/transaction-logging.dto';
import {
  TransactionLoggingService,
  DateTimeProxy,
  NotificationService,
} from '../../../../../common';
import { GeneticAnalysisOrderCreatedCommand } from './genetic-analysis-order-created.command';
import { NotificationDto } from '../../../../../common/notification/dto/notification.dto';

@Injectable()
@CommandHandler(GeneticAnalysisOrderCreatedCommand)
export class GeneticAnalysisOrderCreatedHandler
  implements ICommandHandler<GeneticAnalysisOrderCreatedCommand>
{
  private readonly logger: Logger = new Logger(
    GeneticAnalysisOrderCreatedCommand.name,
  );
  constructor(
    private readonly loggingService: TransactionLoggingService,
    private readonly notificationService: NotificationService,
    private readonly dateTimeProxy: DateTimeProxy,
  ) {}

  async execute(command: GeneticAnalysisOrderCreatedCommand) {
    const geneticAnalysisOrder = command.geneticAnalysisOrders.normalize();
    const blockNumber = command.blockMetaData.blockNumber.toString();
    await this.logger.log(
      `Genetic Analysis Order Created With GA Order ID: ${geneticAnalysisOrder.id}!`,
    );

    try {
      const isGeneticAnalysisOrderHasBeenInsert =
        await this.loggingService.getLoggingByHashAndStatus(
          geneticAnalysisOrder.id,
          13,
        );

      const geneticAnalysisOrderLogging: TransactionLoggingDto = {
        address: geneticAnalysisOrder.customerId,
        amount: 0,
        created_at: geneticAnalysisOrder.createdAt,
        currency: geneticAnalysisOrder.currency.toUpperCase(),
        parent_id: BigInt(0),
        ref_number: geneticAnalysisOrder.id,
        transaction_status: 13,
        transaction_type: 3,
      };
      const currDateTime = this.dateTimeProxy.new();
      const notificationInput: NotificationDto = {
        role: 'Customer',
        entity_type: 'Genetic Analysis Orders',
        entity: 'Order Created',
        reference_id: geneticAnalysisOrder.id,
        description: `You've successfully submitted your requested test for [].`,
        read: false,
        created_at: currDateTime,
        updated_at: currDateTime,
        deleted_at: null,
        from: 'Debio Network',
        to: geneticAnalysisOrder.customerId,
        block_number: blockNumber,
      };

      if (!isGeneticAnalysisOrderHasBeenInsert) {
        await this.loggingService.create(geneticAnalysisOrderLogging);
        await this.notificationService.insert(notificationInput);
      }
    } catch (error) {
      await this.logger.log(error);
    }
  }
}
