import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Index(['status', 'nextRetryAt'])
@Entity('buy_item_outbox')
export class BuyItemOutbox {
  @PrimaryGeneratedColumn()
  id: number;

  // { userId, amount, idempotencyKey }
  @Column('json')
  payload: { userId: number; amount: number; idempotencyKey: string };

  // PENDING → PROCESSING → DONE
  // Không có FAILED — bắt buộc phải trừ được tiền vì item đã tồn tại trong DB
  @Column({ default: 'PENDING' })
  status: string;

  @Column({ default: 0 })
  retries: number;

  @Column({ type: 'datetime', default: () => 'NOW()' })
  nextRetryAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}