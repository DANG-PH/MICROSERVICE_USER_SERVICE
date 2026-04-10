import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne,CreateDateColumn,UpdateDateColumn } from 'typeorm';
import { User_Game_Stats } from 'src/service-trong/user-game-stats/user-game-stats.entity';
import { User_Position } from 'src/service-trong/user-position/user-positon.entity';
import { User_Web_Item } from 'src/service-trong/user-web-item/user-web-item.entity';

@Entity('users')
export class User_Entity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({type: 'bigint', nullable: true })
  auth_id: number;

  @Column({ nullable: true, default: "" })
  gameName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User_Game_Stats, userGameStats => userGameStats.user, { cascade: true, eager: false })
  userGameStats: User_Game_Stats;

  @OneToOne(() => User_Position, userPosition => userPosition.user, { cascade: true, eager: false })
  userPosition: User_Position;

  @OneToMany(() => User_Web_Item, item => item.user, { cascade: true, eager: false })
  danhSachVatPhamWeb: User_Web_Item[];
}
