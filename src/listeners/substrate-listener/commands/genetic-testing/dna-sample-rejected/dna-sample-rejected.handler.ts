import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DnaSampleRejectedCommand } from './dna-sample-rejected.command';
import { NotificationDto } from '../../../../../common/notification/dto/notification.dto';
import { DateTimeProxy, NotificationService } from '../../../../../common';

@Injectable()
@CommandHandler(DnaSampleRejectedCommand)
export class DnaSampleRejectedCommandHandler
  implements ICommandHandler<DnaSampleRejectedCommand>
{
  constructor(
    private readonly notificationService: NotificationService,
    private readonly dateTimeProxy: DateTimeProxy,
  ) {}

  async execute(command: DnaSampleRejectedCommand) {
    const dnaSample = command.dnaSample;
    const blockNumber = command.blockMetaData.blockNumber.toString();

    const currDateTime = this.dateTimeProxy.new();

    const sampleRejectedNotification: NotificationDto = {
      role: 'Customer',
      entity_type: 'Genetic Testing Tracking',
      entity: 'QC Failed',
      reference_id: dnaSample.trackingId,
      description: `Your sample from [] has been rejected. Click here to see your order details.`,
      read: false,
      created_at: currDateTime,
      updated_at: currDateTime,
      deleted_at: null,
      from: 'Debio Network',
      to: dnaSample.ownerId,
      block_number: blockNumber,
    };

    await this.notificationService.insert(sampleRejectedNotification);
  }
}
