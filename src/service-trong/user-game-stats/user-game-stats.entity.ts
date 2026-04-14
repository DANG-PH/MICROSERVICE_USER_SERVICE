import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn, Index } from 'typeorm';
import { User_Entity } from 'src/service-trong/user/user.entity';

@Entity('user-game-stats')
export class User_Game_Stats {
  @PrimaryGeneratedColumn()
  id: number;

  /**
 * Index cho leaderboard query
 *
 * Use case:
 * - Lấy top N user:
 *   SELECT * FROM user_game_stats
 *   ORDER BY sucManh DESC LIMIT 10
 *
 * Nếu KHÔNG có index:
 * - DB phải scan toàn bộ bảng + sort lại
 * - Complexity ~ O(n log n)
 * - Khi data lớn (10k+ users) sẽ chậm rõ rệt
 *
 * Nếu CÓ index (B+Tree):
 * - Dữ liệu luôn được maintain theo thứ tự khi insert/update
 * - Query chỉ cần:
 *   + đi tới leaf node lớn nhất
 *   + đọc N phần tử đầu
 * - Complexity ~ O(log n)
 *
 * Trade-off:
 * - Write (update sucManh/vang) chậm hơn chút (~O(log n))
 * - Nhưng read (leaderboard) nhanh hơn rất nhiều
 *
 * Chấp nhận trade-off này vì:
 * - Leaderboard là read-heavy (bị gọi nhiều)
 * - UX yêu cầu response nhanh
 *
 * Kết luận:
 * - Bắt buộc index cho các field dùng trong ORDER BY + LIMIT ( bắt buộc có limit k thì popularity cao và sẽ overhead, lúc này scan full nhanh hơn )
 * - Case order by stanlone này là kinh điển
 * - Các case gặp kinh điển khác có thể là:
 *   index để order là composite index với selectivity(A) + selectivity(B) + order by (C)
 */
  @Index()
  @Column({ type: 'bigint', default: 0 })
  vang: number;

  @Column({ type: 'bigint', default: 0 })
  ngoc: number;

  @Index()
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

    /**
   * FK column thật sự trong DB
   *
   * Quan trọng:
   * - Nếu KHÔNG khai báo @Column này:
   *   → TypeORM vẫn sẽ tự tạo 1 cột FK (thường là userId hoặc user_id)
   *   → nhưng:
   *     + Không truy cập trực tiếp được trong code (không có field user_id)
   *     + Khó control index
   *     + Phụ thuộc vào naming strategy của ORM
   *
   * - Khi KHAI BÁO rõ ràng:
   *   → Bạn control hoàn toàn schema DB
   *   → Có thể query/update trực tiếp bằng user_id (không cần join)
   *   → Đảm bảo index tồn tại đúng như mong muốn
   *
   * Performance:
   * - Dùng user_id để:
   *   + update nhanh (UPDATE ... WHERE user_id = ?)
   *   + increment trực tiếp (không load relation)
   *   + tránh JOIN không cần thiết
   *
   * Unique constraint:
   * - Vì đây là OneToOne:
   *   → mỗi user chỉ có 1 record stats
   *   → cần unique để enforce ở DB level
   *
   * InnoDB:
   * - @Index({ unique: true }) thực chất tạo UNIQUE INDEX
   * - tương đương @Column({ unique: true }) về mặt DB
   * - nhưng @Index cho phép control tốt hơn (naming, composite index)
   */
  @Column()
  @Index({ unique: true }) // hoặc để unique trên column, với innoDB thì tương tự nhau đều là Unique Indexing
  user_id: number;

  /**
   * Relation mapping
   *
   * - Map entity → object (TypeORM layer)
   * - Sử dụng chính cột user_id ở trên (do @JoinColumn chỉ định)
   *
   * Lưu ý:
   * - DB KHÔNG hiểu relation này
   * - DB chỉ dùng user_id để JOIN
   */
  @OneToOne(() => User_Entity, user => user.userGameStats, { nullable: false })
  @JoinColumn({ name: 'user_id' }) 
  user: User_Entity;
}
