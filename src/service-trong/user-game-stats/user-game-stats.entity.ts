import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { User_Entity } from 'src/service-trong/user/user.entity';

@Entity('user-game-stats')
export class User_Game_Stats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', default: 0 })
  vang: number;

  @Column({ type: 'bigint', default: 0 })
  ngoc: number;

  @Column({ type: 'bigint', default: 0 })
  sucManh: number;

  @Column({ type: 'bigint', default: 0 })
  vangNapTuWeb: number;

  @Column({ type: 'bigint', default: 0 })
  ngocNapTuWeb: number;

  @Column({ default: false })
  daVaoTaiKhoanLanDau: boolean;

  @Column({ default: false })
  coDeTu: boolean;

  @OneToOne(() => User_Entity, user => user.userGameStats, { nullable: false })
  @JoinColumn({ name: 'user_id' }) 
  user: User_Entity;
}
