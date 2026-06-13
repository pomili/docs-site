import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import styles from './drone.module.css';

interface LinkItem {
  name: string;
  url: string;
}

const px4: LinkItem[] = [
  { name: 'PX4 官网', url: 'https://px4.io/' },
  { name: 'PX4 用户指南', url: 'https://docs.px4.io/' },
  { name: 'PX4 开发者指南', url: 'https://docs.px4.io/main/en/development/' },
  { name: 'QGroundControl', url: 'http://qgroundcontrol.com/' },
  { name: 'ArduPilot', url: 'https://ardupilot.org/' },
  { name: 'MAVSDK', url: 'https://mavsdk.mavlink.io/' },
  { name: 'MAVLink 协议', url: 'https://mavlink.io/' },
  { name: 'Pixhawk 硬件', url: 'https://docs.px4.io/main/en/flight_controller/' },
];

const ros2: LinkItem[] = [
  { name: 'ROS2 文档', url: 'https://docs.ros.org/en/rolling/' },
  { name: 'ROS2 Humble', url: 'https://docs.ros.org/en/humble/' },
  { name: 'PX4-ROS2 桥接', url: 'https://docs.px4.io/main/en/ros/ros2_comm.html' },
  { name: 'Micro XRCE-DDS', url: 'https://micro-xrce-dds.docs.eprosima.com/' },
  { name: 'Nav2', url: 'https://navigation.ros.org/' },
  { name: 'MoveIt 2', url: 'https://moveit.ros.org/' },
  { name: 'ros2_control', url: 'https://control.ros.org/' },
  { name: 'Foxglove', url: 'https://foxglove.dev/' },
];

const simulation: LinkItem[] = [
  { name: 'Gazebo', url: 'https://gazebosim.org/' },
  { name: 'PX4 SITL 仿真', url: 'https://docs.px4.io/main/en/simulation/' },
  { name: 'jMAVSim', url: 'https://docs.px4.io/main/en/simulation/jmavsim.html' },
  { name: 'AirSim', url: 'https://microsoft.github.io/AirSim/' },
  { name: 'Isaac Sim', url: 'https://developer.nvidia.com/isaac-sim' },
  { name: 'Webots', url: 'https://cyberbotics.com/' },
  { name: 'Gazebo 经典版', url: 'https://classic.gazebosim.org/' },
];

const onboardComputer: LinkItem[] = [
  { name: 'NVIDIA Jetson', url: 'https://developer.nvidia.com/embedded-computing' },
  { name: 'JetPack SDK', url: 'https://developer.nvidia.com/embedded/jetpack' },
  { name: '树莓派', url: 'https://www.raspberrypi.com/' },
  { name: 'Intel NUC', url: 'https://www.intel.com/content/www/us/en/products/details/nuc.html' },
  { name: 'NXP NavQPlus', url: 'https://nxp.gitbook.io/navqplus' },
];

const vision: LinkItem[] = [
  { name: 'OpenCV', url: 'https://opencv.org/' },
  { name: 'VINS-Mono', url: 'https://github.com/HKUST-Aerial-Robotics/VINS-Mono' },
  { name: 'ORB-SLAM3', url: 'https://github.com/UZ-SLAMLab/ORB_SLAM3' },
  { name: 'Intel RealSense', url: 'https://www.intelrealsense.com/' },
  { name: 'OAK-D', url: 'https://docs.luxonis.com/' },
  { name: 'TensorRT', url: 'https://developer.nvidia.com/tensorrt' },
];

const communication: LinkItem[] = [
  { name: 'ELRS', url: 'https://www.expresslrs.org/' },
  { name: 'Crossfire', url: 'https://www.team-blacksheep.com/' },
  { name: 'FrSky', url: 'https://www.frsky-rc.com/' },
  { name: '4G/5G 数传', url: 'https://docs.px4.io/main/en/telemetry/' },
];

const hardware: LinkItem[] = [
  { name: 'Holybro', url: 'https://holybro.com/' },
  { name: 'CUAV', url: 'https://www.cuav.net/' },
  { name: 'T-Motor', url: 'https://store.tmotor.com/' },
  { name: 'DJI 开发平台', url: 'https://www.dji.com/developer' },
  { name: 'Holybro RTK GPS', url: 'https://holybro.com/collections/rtk-gps' },
];

const community: LinkItem[] = [
  { name: 'PX4 论坛', url: 'https://discuss.px4.io/' },
  { name: 'ROS 论坛', url: 'https://discourse.ros.org/' },
  { name: 'DIY Drones', url: 'https://diydrones.com/' },
  { name: 'FPV 社区', url: 'https://www.rcgroups.com/' },
  { name: 'ArduPilot 论坛', url: 'https://discuss.ardupilot.org/' },
  { name: 'Dronecode', url: 'https://www.dronecode.org/' },
];

function Section({title, items, dotClass}: {title: string; items: LinkItem[]; dotClass: string}) {
  return (
    <div className={styles.category}>
      <h2 className={styles.categoryTitle}>{title}</h2>
      <div className={styles.tags}>
        {items.map((item) => (
          <a key={item.name} className={styles.tag} href={item.url} target="_blank" rel="noopener noreferrer">
            <span className={`${styles.dot} ${dotClass}`} />
            {item.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Drone(): ReactNode {
  return (
    <Layout title="无人机开发" description="无人机开发工具链与资源导航：PX4/ArduPilot、ROS2、仿真工具、机载计算机、视觉感知">
      <div className={styles.wrap}>
        <div className={styles.hero}>
          <h1 className={styles.title}>无人机开发</h1>
          <p className={styles.subtitle}>PX4 · ROS2 · 仿真 · 机载计算 — 全链路资源导航</p>
        </div>

        <Section title="PX4 飞控" items={px4} dotClass={styles.dotPX4} />
        <Section title="ROS2" items={ros2} dotClass={styles.dotROS2} />
        <Section title="仿真工具" items={simulation} dotClass={styles.dotSim} />
        <Section title="机载计算机" items={onboardComputer} dotClass={styles.dotComputer} />
        <Section title="视觉与感知" items={vision} dotClass={styles.dotVision} />
        <Section title="通信与遥控" items={communication} dotClass={styles.dotComm} />
        <Section title="硬件与传感器" items={hardware} dotClass={styles.dotHardware} />
        <Section title="社区资源" items={community} dotClass={styles.dotResource} />
      </div>
    </Layout>
  );
}
