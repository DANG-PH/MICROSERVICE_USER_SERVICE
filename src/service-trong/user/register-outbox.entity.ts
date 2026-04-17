import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne,CreateDateColumn,UpdateDateColumn, Index } from 'typeorm';

@Index(['status', 'nextRetryAt'])
@Entity('create_pay_outbox')
export class CreatePayOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('json')
  payload: { userId: number };

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'PROCESSING' | 'DONE';
  // Không có FAILED — retry mãi đến khi được

  @Column({ default: 0 })
  retries: number;

  @Column({ nullable: true, type: 'datetime' })
  nextRetryAt: Date;

  @Column({ nullable: true, type: 'text' })
  lastError: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}