import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { User_Game_Stats } from 'src/user-game-stats/user-game-stats.entity';
import { User_Entity } from 'src/user/user.entity';

@Entity('users-position')
export class User_Position {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'float', default: 100 })
  x: number;

  @Column({ type: 'float', default: 175 })
  y: number;

  @Column({ default: 'Nhà Gôhan' })
  mapHienTai: string;

  @OneToOne(() => User_Entity, user => user.userPosition, { nullable: false })
  @JoinColumn({ name: 'user_id' }) 
  user: User_Entity;
}
