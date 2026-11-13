-- Opsional: data nyata 1 Januari 2026 dari AMC Sheet pada Tugas Akhir.
-- Total bagasi/kargo hari itu hanya tersedia per hari, jadi ditaruh di baris pertama.
insert into movements (tanggal,operator,ac_type,reg,flt_arr,flt_dep,orig,dest,sched_arr,ata,block_on,sched_dep,block_off,atd,gh,parking_stand,riu_arr,riu_dep,pax_arr,pax_dep,remark,bagasi_arr,bagasi_dep,kargo_arr,kargo_dep) values
('2026-01-01','Wings Air','AT7','WHV','IW1481','IW1480','BDJ','BDJ','00:20','00:08','00:14','03:25','03:05','03:14','GSA',8,'22','22',32,22,null,6182,3882,8978,654),
('2026-01-01','Indonesia Army','B412','HA5183',null,'HA5183',null,'BEJ',null,null,null,'00:00','00:32','00:38','AMC',2,null,'04',0,0,'MILITARY FLIGHT/EXRON',0,0,0,0),
('2026-01-01','Citilink','A320','GLK','QG460','QG461','SUB','SUB','02:30','02:01','02:09','03:00','02:52','03:03','GAPURA',6,'22','22',128,142,null,0,0,0,0),
('2026-01-01','Garuda Indonesia','B738','GMU','GA580','GA581','CGK','CGK','03:20','02:59','03:05','04:20','04:07','04:14','GAPURA',6,'22','22',34,101,null,0,0,0,0),
('2026-01-01','Super Air Jet','A320','SAE','IU652','IU653','SUB','SUB','03:20','03:24','03:30','04:05','04:04','04:09','GSA',7,'22','22',182,176,null,0,0,0,0),
('2026-01-01','Citilink','A320','GQA','QG422','QG423','CGK','CGK','06:25','06:22','06:30','06:55','07:01','07:10','GAPURA',6,'22','22',110,158,null,0,0,0,0),
('2026-01-01','Batik Air','A320','LUQ','ID6676','ID6677','CGK','CGK','08:55','09:57','10:03','09:35','10:34','10:42','GSA',6,'22','22',143,111,null,0,0,0,0);
