import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User_Entity } from 'src/service-trong/user/user.entity';

@Entity('users-web-item')
export class User_Web_Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({type: 'bigint', nullable: true })
  item_id: number;

  @Column({type: 'bigint', nullable: true })
  price: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // FK column thật sự trong DB
  @Column()
  @Index()
  user_id: number;

  @ManyToOne(() => User_Entity, user => user.danhSachVatPhamWeb, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User_Entity;
}
