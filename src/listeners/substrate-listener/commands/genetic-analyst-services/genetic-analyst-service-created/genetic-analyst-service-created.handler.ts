import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DateTimeProxy, NotificationService } from '../../../../../common';
import { GeneticAnalystServiceCreatedCommand } from './genetic-analyst-service-created.command';
import { NotificationDto } from '../../../../../common/notification/dto/notification.dto';

@Injectable()
@CommandHandler(GeneticAnalystServiceCreatedCommand)
export class GeneticAnalystServiceCreatedCommandHandler
  implements ICommandHandler<GeneticAnalystServiceCreatedCommand>
{
  private readonly logger: Logger = new Logger(
    GeneticAnalystServiceCreatedCommandHandler.name,
  );
  constructor(
    private readonly notificationService: NotificationService,
    private readonly dateTimeProxy: DateTimeProxy,
  ) {}

  async execute(command: GeneticAnalystServiceCreatedCommand) {
    const geneticAnalystService = command.geneticAnalystService;
    const blockNumber = command.blockMetaData.blockNumber.toString();
    try {
      const currDateTime = this.dateTimeProxy.new();

      const geneticAnalystServiceNotification: NotificationDto = {
        role: 'GA',
        entity_type: 'Genetic Analyst',
        entity: 'Add service',
        reference_id: geneticAnalystService.info.name,
        description: `You've successfully added your new service - [].`,
        read: false,
        created_at: currDateTime,
        updated_at: currDateTime,
        deleted_at: null,
        from: 'Debio Network',
        to: geneticAnalystService.ownerId,
        block_number: blockNumber,
      };

      await this.notificationService.insert(geneticAnalystServiceNotification);
    } catch (error) {
      this.logger.log(error);
    }
  }
}
